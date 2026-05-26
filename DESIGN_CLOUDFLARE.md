# Quota — Cloudflare backend (real multi-device, shared inventory)

How Quota goes from the local-first single-device app to a genuinely shared booking
service — **without changing the UI** — by swapping the three local seams for Cloudflare
implementations. Companion to `DESIGN.md` (the verified core), `DESIGN.md §6` (the target
architecture), and `DESIGN_APP.md` (the shell + seams). This file is the transport/infra layer.

> **Status: built & verified end-to-end (local dev).** Backend (`worker/index.ts`,
> `worker/schema.sql`, `wrangler.toml`) **and** client seams (`src/remoteStore.ts`,
> `src/remoteAuth.ts`, `src/remoteCatalog.ts`, gated in `src/config.ts`) are in. The *same*
> `test/browser.mjs` flow passes against both the local-first app (`npm run dev`) **and** this
> Cloudflare backend (`npm run worker:dev`, served by `wrangler dev`): sign-in, page creation,
> booking (never oversells under contention), the provider seeing booker names, and handle
> uniqueness. `test/api.mjs` (`npm run test:api`) additionally curl-checks the API + redaction.
> Run locally: `npm run db:init` (once) then `npm run worker:dev`. **Not yet done for real
> production:** sending actual magic-link email (locally the link is returned in the response),
> remote D1 provisioning, and the hardening in §8/§9. See `README.md` for deploy steps.

---

## 1. The one idea

The app already routes everything through three seams; the backend is a **second
implementation of each**, behind the *same* interfaces, so `App` / `useQuota` / every component
/ `domain.ts` are untouched:

| Seam (interface) | Local (today) | Cloudflare (this doc) |
|---|---|---|
| `PageStore` (`store.ts`) | `LocalStore` + `localStorage` | `RemoteStore` → **Durable Object per page** |
| `Auth` (`auth.ts`) | `LocalAuth` (faked dev link) | `RemoteAuth` → Worker **magic-link** + signed token |
| registry (`catalog.ts` / `identity.ts`) | `localStorage` maps | **D1** (`UNIQUE(username)`, `PRIMARY KEY(username,pagename)`) |

Picking local vs. remote is one branch in `config.ts` (`loadStore`, the `auth` singleton),
gated on `VITE_REMOTE`. The build with `VITE_REMOTE=1` talks to the Worker; `vite dev` stays
pure-local.

## 2. Why this is the architecture the proofs licensed

This is the crux, and it's the **inverse** of Quorum. Quorum's data was partitioned
(conflict-free), so its Durable Object's total order was *sufficient but not necessary* and the
client could be optimistic. Quota's bookings **contend for shared inventory**, so:

- The DO's single-threaded total order is **necessary** — it's what decides who gets the last
  seat. `applyOpPreservesInv` / `replayPreservesInv` mean every state the DO stores (and every
  re-export's replay) is **provably never oversold**.
- The client is **pessimistic** — `book()` already returns the *authoritative* outcome, so the
  local app is **already shaped for this**: `RemoteStore.book()` just awaits the DO's reply
  instead of computing locally. No optimistic rollback, no operational transform.
- **`bookCountOrderInvariant`** is what makes it lock-free-for-safety: every slot's count is
  order-independent even under contention, so **availability/`soldOut` need no locking** — only
  *which booker wins* is order-sensitive, and that is exactly what the single serializer (the
  DO) provides. The proof says we need serialization for *fairness*, nothing more.

So the backend is lock-free and transform-free **because of what we proved**, not in spite of it.

## 3. Components

```
Browser (SPA, unchanged UI)
  ├─ RemoteStore (store.ts)  ──┐
  │    • book/cancel: authed HTTP POST → page DO → authoritative {outcome}
  │    • subscribe: WS to page DO → live availability (counts) push
  ├─ RemoteAuth (auth.ts)  ────┤ HTTPS
  │    • requestLink(email,name) → POST /api/auth/request (emails a signed token)
  │    • signInWithToken → POST /api/auth/verify → session cookie/JWT
  └─ catalog (D1-backed)  ─────┘
                                 ▼
                       Worker (worker/index.ts) — serves dist/ + routes /api/*
                         • validates account tokens; owner-gates management routes
                         • resolves username/pagename → page_id via D1
                         ├──────────────► Durable Object: QuotaPage (one per page_id)
                         │                   • canonical Page in DO storage
                         │                   • mutates ONLY via verified tryBook / cancel /
                         │                     addSlot / setCapacity / closeSlot / applyOp
                         │                   • hibernatable WebSocket fan-out of availability
                         ├──────────────► D1: accounts, handles, pages (+ optional op log)
                         └──────────────► R2: immutable NDJSON exports (the corpus)
```

- **One Worker** serves the built SPA (`[assets]` → `dist/`) and `/api/*`; no separate host.
- **One Durable Object per page**, addressed by `idFromName(page_id)` (the opaque id, *not* the
  vanity path — so renaming a page/handle in D1 never moves the DO or disturbs bookings).
  Single-threaded ⇒ the necessary total order, for free.
- **Hibernation API** (`state.acceptWebSocket` + `webSocketMessage`/`webSocketClose`) so idle
  pages cost nothing; the WS is used for *live availability*, not for the (HTTP) booking action.

## 4. Auth & accounts (the unified model, server-side)

One account per email; "provider" = owns ≥ 1 page. Everyone authenticates (bookers included,
per the app's current model).

- **Magic link**: `requestLink(email, name)` → Worker stores a short-lived signed token (HMAC
  with a Worker secret) and **emails** the link (e.g. via MailChannels / Resend). Clicking it →
  `verify` checks the signature/expiry → issues a session (JWT cookie). This is the real version
  of `LocalAuth`'s faked dev link.
- **D1 tables**:
  - `accounts(email PK, name)` — the people directory (provider reads booker names).
  - `handles(handle PK, email)` — the **unique** username registry (`claimHandle` → a row).
  - `pages(username, pagename, page_id, title, PRIMARY KEY(username, pagename))` — vanity →
    opaque id; `username` references `handles`.
  - *(optional)* `ops(page_id, seq, kind, slot_idx, booking_id, key, at, PRIMARY KEY(page_id, seq))`
    — the append-only corpus `replay` folds; enables SQL analytics + R2 export. Deferred; the
    DO's materialized `Page` suffices for the live app first.
- **Booker identity = the authenticated account**: the verified dedup `key` is the booker's
  email (or a stable account id); name/email live in `accounts` (provider-only). The DO never
  trusts a client-supplied identity — it reads it from the validated token.

## 5. Request/protocol shape

- **View availability** (public, no auth): `GET /api/pages/:id` (snapshot) + a **WebSocket** to
  the DO that pushes **redacted state** (per-slot counts only — never booker identities) on
  every change. This is the public booking page's live view.
- **Book / cancel** (authenticated): `POST /api/pages/:id/book {slotIdx}` (booker key comes from
  the token) → DO runs `tryBook` server-authoritatively → returns `{outcome, bookingId}`
  (pessimistic). `POST …/cancel {bookingId}` → DO `cancel`. Each broadcasts new availability.
- **Manage** (authenticated **and** page owner): `POST …/slots`, `…/capacity`, `…/close`,
  `GET …/bookers` (full names/emails — provider only). The Worker checks the token's account
  owns the page's `username` before forwarding to the DO.
- **Export**: `GET /api/pages/:id/export.ndjson` (owner-authed; PII included) streams the
  bookings; `replay` determinism makes re-export reproducible. Public export, if offered, is
  counts-only.

## 6. Privacy & trust boundary (restated)

The public WS/snapshot carry **availability only**; booker names/emails are returned solely on
owner-authenticated endpoints (DESIGN.md §6). **Verified**: all slot-index math, the count,
accept/reject, capacity safety, conservation, cancellation, op-log replay determinism, the order
theorem — all run **server-side in the DO** via the same `domain.ts`. **Trusted** (stated
honestly): magic-link auth + token signing, the React UI, WebSocket/DO/D1/R2 I/O, email
delivery, the `slot ⟷ (date,time,label,timezone)` labeling, and abuse/rate-limiting/spoofing.

## 7. Hosting / deploy

- `wrangler.toml`: a Durable Object binding (`QuotaPage`), a D1 binding, an R2 binding, an
  `[assets]` dir (`dist/`), and secrets (`AUTH_SECRET`, email-provider key).
- **Local dev**: `wrangler dev` runs the Worker + DO + D1 + WebSocket offline (workerd/miniflare);
  drive two browser contexts to see one device's booking fill the other's availability live.
  Build the remote bundle with `VITE_REMOTE=1` (a `worker:dev` script), like Quorum.
  Gotcha (from Quorum): for headless tests don't wait on `networkidle` with an open WS — use
  `domcontentloaded`.
- **Deploy**: `npm run build && wrangler deploy` to the owner's account; D1 migrations apply the
  registry schema.

## 8. Decisions (recommended — confirm when we build)

1. **Booking over authed HTTP POST; availability over hibernatable WS.** Recommended — actions
   are pessimistic request/response (a clean fit) and the WS only pushes counts. Alternative:
   everything over WS (one channel), as Quorum does.
2. **Materialized `Page` in DO storage first; the D1 op-log corpus deferred.** Recommended for
   the first cut; add `ops` + R2 export when analytics/audit are wanted.
3. **Server-authoritative booking (no optimistic apply).** Recommended — contention makes
   optimism unsafe for the *winner*; the proof only frees us from locking the *count*. The UI's
   "pending… → outcome" already models this.
4. **Backend opt-in via `VITE_REMOTE`** so the pure-local SPA keeps working with no Worker.

## 9. Open questions / deferred

- **Tentative holds / TTL** (DESIGN.md §11) — a held → confirmed | expired sub-state pulls a
  clock into the core; decide before building if bookings should be instant-confirm (current) or
  held briefly. Affects the DO (timers) and possibly a new verified stage.
- **Booker-facing confirmation/cancellation emails** — now that bookers are authed, the DO/Worker
  can email a confirmation + a cancel link on `book`. Pure infra (trusted), no core change.
- **Rate-limiting / abuse** on the public booking endpoint (a trusted edge).
- **Global handle claim** — `claimHandle` becomes an atomic D1 insert on `handles(handle PK)`;
  decide whether providers *pick* a handle (vs. auto-derive) at first sign-in.
- **Cross-device "your bookings"** — falls out for free now that identity is the account
  (`key === email`), no per-device list needed.
