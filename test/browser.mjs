// Browser smoke: drive the real app in Chrome through the full flow (sign in →
// magic link → create page → book → provider sees booker → handle uniqueness),
// asserting no console/page errors. Works against BOTH backends:
//   local:   npm run dev            && BASE=http://localhost:5174/ node test/browser.mjs
//   remote:  npm run worker:dev     && BASE=http://localhost:8787/ node test/browser.mjs
// Needs playwright-core + system Chrome (channel "chrome").
import { chromium } from "playwright-core"

const BASE = process.env.BASE ?? "http://localhost:5174/"
const shot = (name) => `/tmp/quota-${name}.png`

// Unique per run so it's re-runnable against persistent (D1) state.
const runId = Date.now().toString().slice(-7)
const local = `sam${runId}` // shared email local-part → handle "sam<runId>"
const handle = local // baseHandle(local) === local (alphanumeric)
const slug = `yoga${runId}`

const pageErrors = []
const consoleErrors = []
let failed = false
const step = (msg) => console.log("•", msg)
const ok = (msg) => console.log("  ok:", msg)
const fail = (msg) => {
  console.error("  FAIL:", msg)
  failed = true
}

const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage()
page.on("pageerror", (e) => pageErrors.push(e.message))
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text())
})

async function signIn(email) {
  await page.getByPlaceholder("you@example.com").fill(email)
  await page.getByRole("button", { name: "Send magic link" }).click()
  await page.getByRole("link", { name: /Open magic link/ }).click()
}

try {
  step("load + sign in (email-only magic-link round-trip)")
  await page.goto(BASE, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Send magic link" }).waitFor({ timeout: 10000 })
  await signIn(`${local}@example.com`)
  await page.getByText("Your pages").waitFor({ timeout: 10000 })
  await page.screenshot({ path: shot("console") })
  ok("signed in; console rendered (no loop)")

  step("set display name on the Account page (a profile setting, not at sign-in)")
  await page.evaluate(() => {
    location.hash = "#/account"
  })
  const nameField = page.getByPlaceholder("Your name")
  await nameField.waitFor({ timeout: 10000 })
  await nameField.fill("Sam")
  await page.getByRole("button", { name: "Save" }).click()
  await page.getByText("Saved.").waitFor({ timeout: 10000 })
  ok("display name saved")

  step("create a page (capacity-1 slot)")
  await page.evaluate(() => {
    location.hash = "#/new"
  })
  await page.getByPlaceholder("Yoga with Sam").fill("Yoga with Sam")
  await page.getByPlaceholder("yoga", { exact: true }).fill(slug)
  await page.getByPlaceholder(/Slot 1/).fill("Mon 9:00 AM")
  await page.getByLabel("capacity").first().fill("1")
  await page.getByRole("button", { name: "Create page" }).click()
  await page.getByRole("button", { name: "View public page" }).waitFor({ timeout: 10000 })
  ok(`page created at ${handle}/${slug}`)

  step("open public page and book the seat")
  await page.getByRole("button", { name: "View public page" }).click()
  const bookBtn = page.getByRole("button", { name: "Book" }).first()
  await bookBtn.waitFor({ timeout: 10000 })
  await bookBtn.click()
  await page.getByText("You're in").waitFor({ timeout: 10000 })
  await page.screenshot({ path: shot("booked") })
  ok("booked; 'You're in' shown")

  step("provider sees the booker by display name")
  await page.evaluate((h) => {
    location.hash = h
  }, `#/${handle}/${slug}/manage`)
  await page.getByRole("button", { name: "View public page" }).waitFor({ timeout: 10000 })
  // Target the booker badge specifically (title = the booker's email), not the header.
  const badge = page.locator(`[title="${local}@example.com"]`)
  await badge.waitFor({ timeout: 10000 })
  await page.screenshot({ path: shot("manage-booked") })
  if ((await badge.innerText()).trim() === "Sam") ok("booker badge shows the display name (Sam)")
  else fail(`booker badge: "${(await badge.innerText()).trim()}"`)

  step("handle uniqueness: 2nd account, same email local-part → disambiguated")
  await page.getByRole("button", { name: "Sign out" }).click()
  await page.getByRole("button", { name: "Send magic link" }).waitFor({ timeout: 10000 })
  await signIn(`${local}@other.test`)
  await page.getByText("Your pages").waitFor({ timeout: 10000 })
  const handleText = await page.getByText(new RegExp(`quota\\.app/${handle}`)).innerText()
  if (handleText.includes(`${handle}-2`)) ok(`2nd account got a distinct handle (${handleText.trim()})`)
  else fail(`2nd handle not disambiguated: "${handleText.trim()}"`)
} catch (e) {
  fail(`flow threw: ${e.message}`)
  await page.screenshot({ path: shot("error") }).catch(() => {})
} finally {
  await browser.close()
}

if (pageErrors.length > 0) {
  fail(`${pageErrors.length} page error(s):`)
  pageErrors.forEach((e) => console.error("    ", e))
}
if (consoleErrors.length > 0) {
  fail(`${consoleErrors.length} console error(s):`)
  consoleErrors.forEach((e) => console.error("    ", e))
}

console.log(failed ? "\nBROWSER SMOKE FAILED" : "\nBrowser smoke passed. Screenshots in /tmp/quota-*.png")
process.exit(failed ? 1 : 0)
