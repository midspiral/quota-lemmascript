// Quota Cloudflare backend.
//
//  • One Worker: serves the SPA (ASSETS) + routes /api/*, runs custom magic-link
//    auth, owns the D1 registry, and forwards page actions to the page's DO.
//  • One Durable Object per page (QuotaPage): holds the canonical Page and
//    mutates it ONLY via the verified domain functions — the SAME domain.ts the
//    browser uses. Single-threaded ⇒ the necessary total order over contending
//    bookings; applyOp/replay/tryBook are proved never to oversell.
//
// Auth & registry are the trusted edge (outside the verified core).
import type { Page, Slot, Booking } from "../src/domain"
import { initPage, tryBook, cancel, addSlot, setCapacity, closeSlot, confirmedCount } from "../src/domain"
import type { StytchConfig } from "./stytch"
import { stytchEnabled, stytchSendMagicLink, stytchAuthenticate } from "./stytch"

export interface Env {
  ASSETS: Fetcher
  QUOTA_PAGE: DurableObjectNamespace
  DB: D1Database
  AUTH_SECRET: string
  // Optional Stytch credentials. When set, the magic link is sent by Stytch
  // (real email); when unset, the Worker uses its own keyless HMAC link (dev).
  STYTCH_PROJECT_ID?: string
  STYTCH_SECRET?: string
  STYTCH_API_URL?: string
}

const stytchCfg = (env: Env): StytchConfig => ({
  projectId: env.STYTCH_PROJECT_ID,
  secret: env.STYTCH_SECRET,
  apiUrl: env.STYTCH_API_URL,
})

// Mint our own session (handle claim + HMAC bearer), shared by both auth paths.
// Sign-in is email-only; the display name is a separate profile setting (accounts).
async function issueSession(env: Env, email: string): Promise<Response> {
  const handle = await claimHandle(env, email)
  const session: Session = { email, handle }
  const token = await makeToken({ k: "s", ...session }, env.AUTH_SECRET, 60 * 60 * 24 * 30)
  return json({ session, token })
}

interface Session {
  email: string
  handle: string
}

// ── tiny JSON helpers ─────────────────────────────────────────
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
const bad = (msg: string, status = 400): Response => json({ error: msg }, status)

// ── signed tokens (HMAC-SHA256 via WebCrypto) ─────────────────
const enc = new TextEncoder()
const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const b64urlDecode = (s: string): string => atob(s.replace(/-/g, "+").replace(/_/g, "/"))

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

async function makeToken(payload: Record<string, unknown>, secret: string, ttlSec: number): Promise<string> {
  const body = { ...payload, exp: Date.now() + ttlSec * 1000 }
  const data = b64url(enc.encode(JSON.stringify(body)))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data))
  return `${data}.${b64url(new Uint8Array(sig))}`
}

async function readToken(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const dot = token.indexOf(".")
  if (dot < 0) return null
  const data = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = b64url(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data))))
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(b64urlDecode(data)) as Record<string, unknown>
    if (typeof payload.exp === "number" && payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

async function sessionFrom(req: Request, env: Env): Promise<Session | null> {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  if (token === "") return null
  const p = await readToken(token, env.AUTH_SECRET)
  if (p === null || p.k !== "s") return null
  return { email: String(p.email), handle: String(p.handle) }
}

// ── D1 registry ───────────────────────────────────────────────
function baseHandle(email: string): string {
  const local = email.split("@")[0] ?? "user"
  return local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "user"
}

async function claimHandle(env: Env, email: string): Promise<string> {
  const existing = await env.DB.prepare("SELECT handle FROM handles WHERE email = ?").bind(email).first<{ handle: string }>()
  if (existing !== null) return existing.handle
  const base = baseHandle(email)
  for (let n = 1; ; n++) {
    const handle = n === 1 ? base : `${base}-${n}`
    await env.DB.prepare("INSERT OR IGNORE INTO handles (handle, email) VALUES (?, ?)").bind(handle, email).run()
    const owner = await env.DB.prepare("SELECT email FROM handles WHERE handle = ?").bind(handle).first<{ email: string }>()
    if (owner !== null && owner.email === email) return handle
  }
}

// ── DO forwarding ─────────────────────────────────────────────
function pageStub(env: Env, pageId: string): DurableObjectStub {
  return env.QUOTA_PAGE.get(env.QUOTA_PAGE.idFromName(pageId))
}
function callDO(env: Env, pageId: string, path: string, init?: RequestInit): Promise<Response> {
  return pageStub(env, pageId).fetch(new Request(`https://do${path}`, init))
}

// ── Worker ────────────────────────────────────────────────────
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith("/api/")) return handleApi(req, env, url).catch((e) => bad(String(e), 500))
    return env.ASSETS.fetch(req)
  },
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean)
  const method = req.method

  // --- auth (email only; display name is a separate profile setting) ---
  if (parts[0] === "auth" && parts[1] === "request" && method === "POST") {
    const { email, returnTo } = (await req.json()) as { email?: string; returnTo?: string }
    if (!email || !email.includes("@")) return bad("email required")
    const rt = encodeURIComponent(typeof returnTo === "string" && returnTo !== "" ? returnTo : "/")
    const cfg = stytchCfg(env)
    if (stytchEnabled(cfg)) {
      // Bare root URL — Stytch validates redirect URLs strictly (extra query params
      // rejected) and appends its own ?token=…&stytch_token_type=… for the SPA.
      const origin = new URL(req.url).origin
      const ok = await stytchSendMagicLink(cfg, email, `${origin}/`)
      return ok ? json({ sent: true }) : bad("could not send the sign-in email", 502)
    }
    // Keyless dev fallback: our own HMAC link, surfaced in the response.
    const token = await makeToken({ k: "ml", email }, env.AUTH_SECRET, 900)
    return json({ devLink: `#/auth?token=${token}&returnTo=${rt}` })
  }
  if (parts[0] === "auth" && parts[1] === "verify" && method === "POST") {
    const { token } = (await req.json()) as { token?: string }
    if (!token) return bad("invalid or expired link", 401)
    const cfg = stytchCfg(env)
    if (stytchEnabled(cfg)) {
      const r = await stytchAuthenticate(cfg, token)
      if (r === null) return bad("invalid or expired link", 401)
      return issueSession(env, r.email)
    }
    const p = await readToken(token, env.AUTH_SECRET)
    if (p === null || p.k !== "ml") return bad("invalid or expired link", 401)
    return issueSession(env, String(p.email))
  }
  if (parts[0] === "auth" && parts[1] === "me" && method === "GET") {
    const s = await sessionFrom(req, env)
    return s === null ? bad("not signed in", 401) : json({ session: s })
  }

  // --- profile (display name), per the authenticated account ---
  if (parts[0] === "account" && parts.length === 1) {
    const s = await sessionFrom(req, env)
    if (s === null) return bad("sign in required", 401)
    if (method === "GET") {
      const row = await env.DB.prepare("SELECT name FROM accounts WHERE email = ?").bind(s.email).first<{ name: string }>()
      return json({ name: row?.name ?? "" })
    }
    if (method === "POST") {
      const { name } = (await req.json()) as { name?: string }
      await env.DB.prepare("INSERT INTO accounts (email, name) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name")
        .bind(s.email, (name ?? "").trim())
        .run()
      return json({ name: (name ?? "").trim() })
    }
  }

  // --- create page (auth) ---
  if (parts[0] === "pages" && parts.length === 1 && method === "POST") {
    const s = await sessionFrom(req, env)
    if (s === null) return bad("sign in required", 401)
    const { pagename, title, slots } = (await req.json()) as { pagename?: string; title?: string; slots?: Slot[] }
    const name = (pagename ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    if (name === "" || !title || !Array.isArray(slots)) return bad("pagename, title, slots required")
    const taken = await env.DB.prepare("SELECT 1 FROM pages WHERE username = ? AND pagename = ?").bind(s.handle, name).first()
    if (taken !== null) return bad("you already have a page with that slug", 409)
    const pageId = crypto.randomUUID()
    await env.DB.prepare("INSERT INTO pages (username, pagename, page_id, title) VALUES (?, ?, ?, ?)")
      .bind(s.handle, name, pageId, title)
      .run()
    await callDO(env, pageId, "/init", { method: "POST", body: JSON.stringify({ pageId, title, slots }) })
    return json({ username: s.handle, pagename: name, pageId })
  }

  // --- resolve vanity url (public) ---
  if (parts[0] === "u" && parts.length === 3 && method === "GET") {
    const row = await env.DB.prepare("SELECT page_id, title FROM pages WHERE username = ? AND pagename = ?")
      .bind(parts[1], parts[2])
      .first<{ page_id: string; title: string }>()
    return row === null ? bad("not found", 404) : json({ pageId: row.page_id, title: row.title })
  }

  // --- my pages (auth) ---
  if (parts[0] === "me" && parts[1] === "pages" && method === "GET") {
    const s = await sessionFrom(req, env)
    if (s === null) return bad("sign in required", 401)
    const { results } = await env.DB.prepare("SELECT username, pagename, page_id AS pageId, title FROM pages WHERE username = ?")
      .bind(s.handle)
      .all()
    return json({ pages: results })
  }

  // --- page actions: /api/pages/:pageId/<action> ---
  if (parts[0] === "pages" && parts.length >= 2) {
    const pageId = parts[1]
    const action = parts[2] ?? "state"
    const s = await sessionFrom(req, env)

    if (action === "ws") return pageStub(env, pageId).fetch(new Request("https://do/ws", req))

    if (action === "state" && method === "GET") {
      return callDO(env, pageId, `/state?me=${encodeURIComponent(s?.email ?? "")}`)
    }
    if (action === "book" && method === "POST") {
      if (s === null) return bad("sign in required", 401)
      const { slotIdx } = (await req.json()) as { slotIdx?: number }
      return callDO(env, pageId, `/book?me=${encodeURIComponent(s.email)}`, {
        method: "POST",
        body: JSON.stringify({ idx: slotIdx }),
      })
    }
    if (action === "cancel" && method === "POST") {
      if (s === null) return bad("sign in required", 401)
      const body = await req.text()
      return callDO(env, pageId, `/cancel?me=${encodeURIComponent(s.email)}`, { method: "POST", body })
    }

    // owner-only management
    const owns = s !== null && (await ownsPage(env, pageId, s.handle))
    if ((action === "slots" || action === "capacity" || action === "close") && method === "POST") {
      if (!owns) return bad("not your page", 403)
      const body = await req.text()
      return callDO(env, pageId, `/${action}`, { method: "POST", body })
    }
    if (action === "bookers" && method === "GET") {
      if (!owns) return bad("not your page", 403)
      const res = await callDO(env, pageId, "/bookers")
      const { bookings } = (await res.json()) as { bookings: { slotIdx: number; email: string; bookingId: string }[] }
      // join display names from D1 (provider-only PII); fall back to the email
      const enriched = await Promise.all(
        bookings.map(async (b) => {
          const acc = await env.DB.prepare("SELECT name FROM accounts WHERE email = ?").bind(b.email).first<{ name: string }>()
          const name = acc?.name !== undefined && acc.name !== "" ? acc.name : b.email
          return { ...b, name }
        }),
      )
      return json({ bookers: enriched })
    }
  }

  return bad("not found", 404)
}

async function ownsPage(env: Env, pageId: string, handle: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT username FROM pages WHERE page_id = ?").bind(pageId).first<{ username: string }>()
  return row !== null && row.username === handle
}

// ── Durable Object: one canonical Page per page_id ────────────
// Redact other bookers' identity for a given viewer (counts are unaffected:
// availability depends only on status + slotIdx + capacity, never the key).
function redactFor(page: Page, me: string): Page {
  return {
    ...page,
    bookings: page.bookings.map((b: Booking) => (b.key === me ? b : { ...b, key: "", id: "" })),
  }
}

export class QuotaPage {
  constructor(private ctx: DurableObjectState, _env: Env) {}

  private async getPage(): Promise<Page | null> {
    return (await this.ctx.storage.get<Page>("page")) ?? null
  }
  private async setPage(p: Page): Promise<void> {
    await this.ctx.storage.put("page", p)
  }
  private broadcast(): void {
    for (const ws of this.ctx.getWebSockets()) ws.send(JSON.stringify({ type: "changed" }))
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname
    const me = url.searchParams.get("me") ?? ""

    if (path === "/ws") {
      const pair = new WebSocketPair()
      this.ctx.acceptWebSocket(pair[1])
      return new Response(null, { status: 101, webSocket: pair[0] })
    }

    if (path === "/init") {
      const { pageId, title, slots } = (await req.json()) as { pageId: string; title: string; slots: Slot[] }
      const safe = slots.map((s) => ({ label: s.label, capacity: Math.max(0, s.capacity) }))
      await this.setPage(initPage(pageId, title, safe)) // verified: well-formed
      return json({ ok: true })
    }

    const page = await this.getPage()
    if (page === null) return bad("no such page", 404)

    if (path === "/state") return json({ page: redactFor(page, me) })

    if (path === "/book") {
      const { idx } = (await req.json()) as { idx: number }
      const bookingId = crypto.randomUUID()
      const r = tryBook(page, idx, bookingId, me, Date.now()) // verified: never oversells
      await this.setPage(r.page)
      this.broadcast()
      return json({ outcome: r.outcome, bookingId, page: redactFor(r.page, me) })
    }
    if (path === "/cancel") {
      const { bookingId } = (await req.json()) as { bookingId: string }
      const np = cancel(page, bookingId)
      await this.setPage(np)
      this.broadcast()
      return json({ page: redactFor(np, me) })
    }
    if (path === "/slots") {
      const { label, capacity } = (await req.json()) as { label: string; capacity: number }
      await this.setPage(addSlot(page, label, Math.max(0, capacity)))
      this.broadcast()
      return json({ ok: true })
    }
    if (path === "/capacity") {
      const { idx, capacity } = (await req.json()) as { idx: number; capacity: number }
      const floor = confirmedCount(page.bookings, idx)
      await this.setPage(setCapacity(page, idx, Math.max(floor, capacity)))
      this.broadcast()
      return json({ ok: true })
    }
    if (path === "/close") {
      const { idx } = (await req.json()) as { idx: number }
      await this.setPage(closeSlot(page, idx))
      this.broadcast()
      return json({ ok: true })
    }
    if (path === "/bookers") {
      const bookings = page.bookings
        .filter((b) => b.status === "confirmed")
        .map((b) => ({ slotIdx: b.slotIdx, email: b.key, bookingId: b.id }))
      return json({ bookings })
    }

    return bad("not found", 404)
  }

  // Hibernatable WebSocket: connections only receive "changed" pings; clients
  // re-fetch their (correctly-redacted) state on receipt.
  async webSocketMessage(): Promise<void> {}
  async webSocketClose(): Promise<void> {}
}
