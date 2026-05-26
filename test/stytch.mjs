// Unit test the Stytch helpers (worker/stytch.ts) with a mocked fetch — the
// live Stytch calls need real keys, so this pins the request/response shape.
import { stytchEnabled, stytchSendMagicLink, stytchAuthenticate } from "../worker/stytch.ts"

let fails = 0
const ok = (m) => console.log("  ok:", m)
const fail = (m) => {
  console.error("  FAIL:", m)
  fails++
}
const realFetch = globalThis.fetch

// 1. gating
if (!stytchEnabled({})) ok("stytchEnabled false without credentials")
else fail("stytchEnabled should be false when unset")
if (stytchEnabled({ projectId: "p", secret: "s" })) ok("stytchEnabled true with credentials")
else fail("stytchEnabled should be true when set")

const cfg = { projectId: "project-test-123", secret: "secret-xyz", apiUrl: "https://mock.stytch/v1" }

// 2. send magic link → POSTs the right endpoint with Basic auth + the redirect URL
{
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return { ok: true, json: async () => ({}) }
  }
  const sent = await stytchSendMagicLink(cfg, "sam@example.com", "https://app/#/auth?returnTo=%2F")
  globalThis.fetch = realFetch
  const c = calls[0]
  const body = c ? JSON.parse(c.init.body) : {}
  const expectedAuth = `Basic ${btoa("project-test-123:secret-xyz")}`
  if (
    sent === true &&
    c.url === "https://mock.stytch/v1/magic_links/email/login_or_create" &&
    c.init.headers.authorization === expectedAuth &&
    body.email === "sam@example.com" &&
    body.login_magic_link_url === "https://app/#/auth?returnTo=%2F"
  ) {
    ok("send magic link: endpoint, Basic auth, email + redirect url")
  } else {
    fail(`send magic link shape: sent=${sent} ${JSON.stringify({ url: c?.url, body })}`)
  }
}

// 3. authenticate → extracts the verified email from the user object
{
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ user_id: "u1", user: { emails: [{ email: "sam@example.com" }] } }),
  })
  const r = await stytchAuthenticate(cfg, "tok")
  globalThis.fetch = realFetch
  if (r?.email === "sam@example.com") ok("authenticate extracts the verified email")
  else fail(`authenticate: ${JSON.stringify(r)}`)
}

// 4. authenticate failure → null (no leak)
{
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: "x" }) })
  const r = await stytchAuthenticate(cfg, "bad")
  globalThis.fetch = realFetch
  if (r === null) ok("authenticate returns null on failure")
  else fail(`authenticate failure: ${JSON.stringify(r)}`)
}

console.log(fails === 0 ? "\nStytch unit tests passed." : `\n${fails} failed.`)
process.exit(fails === 0 ? 0 : 1)
