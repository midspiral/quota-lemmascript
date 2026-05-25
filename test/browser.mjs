// Browser smoke: drive the real app in Chrome and assert no console/page errors
// through the full flow (sign in → magic link → create page → book).
// Needs playwright-core + system Chrome (channel: "chrome"); run with dev up:
//   npm run dev &
//   BASE=http://localhost:5174/ node test/browser.mjs
import { chromium } from "playwright-core"

const BASE = process.env.BASE ?? "http://localhost:5174/"
const shot = (name) => `/tmp/quota-${name}.png`

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

try {
  step("load app")
  await page.goto(BASE, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Send magic link" }).waitFor({ timeout: 8000 })
  ok("sign-in screen renders")

  step("request + open magic link")
  await page.getByPlaceholder("Your name").fill("Sam")
  await page.getByPlaceholder("you@example.com").fill("sam@example.com")
  await page.getByRole("button", { name: "Send magic link" }).click()
  const link = page.getByRole("link", { name: /Open magic link/ })
  await link.waitFor({ timeout: 8000 })
  await link.click()

  step("land on console (this is where the infinite loop used to hit)")
  await page.getByText("Your pages").waitFor({ timeout: 8000 })
  await page.screenshot({ path: shot("console") })
  ok("console rendered after sign-in (no loop)")

  step("create a page")
  await page.getByRole("button", { name: /New page/ }).click()
  await page.getByPlaceholder("Yoga with Sam").fill("Yoga with Sam")
  await page.getByPlaceholder(/Slot 1/).fill("Mon 9:00 AM")
  await page.getByLabel("capacity").first().fill("2")
  await page.getByRole("button", { name: "Create page" }).click()
  await page.getByRole("button", { name: "View public page" }).waitFor({ timeout: 8000 })
  await page.screenshot({ path: shot("editor") })
  ok("page created, editor renders")

  step("open public page and book a slot")
  await page.getByRole("button", { name: "View public page" }).click()
  const bookBtn = page.getByRole("button", { name: "Book" }).first()
  await bookBtn.waitFor({ timeout: 8000 })
  await bookBtn.click()
  await page.getByText("You're in").waitFor({ timeout: 8000 })
  await page.screenshot({ path: shot("booked") })
  ok("booked a slot; 'You're in' shown")

  step("provider sees the booker by name")
  await page.evaluate(() => {
    location.hash = "#/sam/yoga-with-sam/manage"
  })
  await page.getByRole("button", { name: "View public page" }).waitFor({ timeout: 8000 })
  await page.screenshot({ path: shot("manage-booked") })
  ok("editor reachable after booking")
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
