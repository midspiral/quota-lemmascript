// Backend smoke: drive the Cloudflare Worker + QuotaPage DO + D1 over HTTP.
// Proves the verified domain.ts runs in the DO (never oversells under
// contention), auth + the D1 registry, owner-only booker names, and redaction.
//   npx wrangler dev --port 8787 &   # then:
//   API=http://localhost:8787 node test/api.mjs
const BASE = process.env.API ?? "http://localhost:8787"
let fails = 0
const ok = (m) => console.log("  ok:", m)
const fail = (m) => {
  console.error("FAIL:", m)
  fails++
}

async function jpost(path, body, token) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  return { status: r.status, data: await r.json().catch(() => null) }
}
async function jget(path, token) {
  const r = await fetch(BASE + path, { headers: token ? { authorization: `Bearer ${token}` } : {} })
  return { status: r.status, data: await r.json().catch(() => null) }
}
async function signIn(email, name) {
  const req = await jpost("/api/auth/request", { email, name })
  const token = req.data.devLink.split("token=")[1].split("&")[0] // devLink now carries &returnTo
  const ver = await jpost("/api/auth/verify", { token })
  return ver.data
}

// Unique per run so it's re-runnable against persistent (D1) state.
const r = Date.now().toString().slice(-7)
const samEmail = `sam${r}@example.com`
const samHandle = `sam${r}`
const slug = `yoga${r}`
const bobEmail = `bob${r}@example.com`

// 1. sign in (magic link round-trip) + handle claim
const sam = await signIn(samEmail, "Sam")
if (sam.session?.handle === samHandle) ok(`sign-in works; handle claimed (${samHandle})`)
else fail(`sign-in/handle: ${JSON.stringify(sam)}`)

// 2. create a page (capacity-1 slot) via D1 registry + DO init
const created = await jpost("/api/pages", { pagename: slug, title: "Yoga", slots: [{ label: "Mon 9", capacity: 1 }] }, sam.token)
const pageId = created.data?.pageId
if (pageId && created.data.username === samHandle) ok(`page created under ${samHandle}/${slug}`)
else fail(`create page: ${JSON.stringify(created)}`)

// 3. resolve the vanity URL (public)
const resolved = await jget(`/api/u/${samHandle}/${slug}`)
if (resolved.data?.pageId === pageId) ok("vanity URL resolves to the page")
else fail(`resolve: ${JSON.stringify(resolved)}`)

// 4. sam books the only seat → confirmed
const b1 = await jpost(`/api/pages/${pageId}/book`, { slotIdx: 0 }, sam.token)
if (b1.data?.outcome === "confirmed") ok("first booking confirmed")
else fail(`book1: ${JSON.stringify(b1)}`)

// 5. sam re-books same slot → duplicate (idempotent), still 1 confirmed
const b2 = await jpost(`/api/pages/${pageId}/book`, { slotIdx: 0 }, sam.token)
if (b2.data?.outcome === "duplicate") ok("same-account re-book → duplicate")
else fail(`book2: ${JSON.stringify(b2)}`)

// 6. bob contends for the full seat → full (capacity safety in the DO)
const bob = await signIn(bobEmail, "Bob")
const b3 = await jpost(`/api/pages/${pageId}/book`, { slotIdx: 0 }, bob.token)
if (b3.data?.outcome === "full") ok("contending booker on a full slot → full (never oversold)")
else fail(`book3: ${JSON.stringify(b3)}`)

// 7. owner sees the booker BY NAME (D1 join)
const bookers = await jget(`/api/pages/${pageId}/bookers`, sam.token)
const first = bookers.data?.bookers?.[0]
if (first?.name === "Sam" && first?.email === samEmail) ok("owner sees booker name (Sam)")
else fail(`bookers: ${JSON.stringify(bookers)}`)

// 8. a non-owner is refused the booker list
const denied = await jget(`/api/pages/${pageId}/bookers`, bob.token)
if (denied.status === 403) ok("non-owner denied the booker list")
else fail(`bookers as bob: ${JSON.stringify(denied)}`)

// 9. redaction: bob's view of state hides sam's identity but keeps the count
const bobState = await jget(`/api/pages/${pageId}/state`, bob.token)
const bk = bobState.data?.page?.bookings ?? []
const confirmed = bk.filter((b) => b.status === "confirmed")
if (confirmed.length === 1 && confirmed[0].key === "") ok("redaction: count visible, other booker's key hidden")
else fail(`bob state: ${JSON.stringify(bk)}`)

console.log(fails === 0 ? "\nAPI smoke passed." : `\n${fails} API check(s) failed.`)
process.exit(fails === 0 ? 0 : 1)
