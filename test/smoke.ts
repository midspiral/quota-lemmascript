// Runtime smoke for the verified core (Node strips the TS types).
//   node test/smoke.ts
import { tryBook, wellFormed, confirmedCount, hasRoom, type Page } from "../src/domain.ts"

let failures = 0
function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log("  ok:", msg)
  } else {
    console.error("FAIL:", msg)
    failures++
  }
}

// A page with two slots, capacity 1 each (the appointment model).
const page0: Page = {
  id: "p1",
  title: "Office hours",
  slots: [{ label: "Mon 9am", capacity: 1 }, { label: "Mon 10am", capacity: 1 }],
  bookings: [],
}

check(wellFormed(page0), "fresh page is well-formed")
check(hasRoom(page0, 0) && hasRoom(page0, 1), "both slots have room")

// Alice grabs slot 0.
const r1 = tryBook(page0, 0, "bk1", "alice", 1)
check(r1.outcome === "confirmed", "first booking on an open slot => confirmed")
check(wellFormed(r1.page), "well-formed after the booking")
check(confirmedCount(r1.page.bookings, 0) === 1, "slot 0 now has 1 confirmed")

// Bob races for the same (now full) slot 0.
const r2 = tryBook(r1.page, 0, "bk2", "bob", 2)
check(r2.outcome === "full", "second booker on a full capacity-1 slot => full")
check(confirmedCount(r2.page.bookings, 0) === 1, "slot 0 NOT oversold (still 1)")

// Alice double-clicks / reconnects: same key, same slot => idempotent.
const r3 = tryBook(r1.page, 0, "bk3", "alice", 3)
check(r3.outcome === "duplicate", "same-key retry on a held slot => duplicate")
check(confirmedCount(r3.page.bookings, 0) === 1, "the retry adds no seat")

// Alice also grabs a different slot — multi-slot is allowed by design.
const r4 = tryBook(r1.page, 1, "bk4", "alice", 4)
check(r4.outcome === "confirmed", "same booker, different slot => confirmed")
check(wellFormed(r4.page), "well-formed after multi-slot booking")

// Booking a non-existent slot is just "full" (no room), page untouched.
const r5 = tryBook(r1.page, 9, "bk5", "carol", 5)
check(r5.outcome === "full", "out-of-range slot => full")
check(r5.page === r1.page, "rejected attempt leaves the page unchanged")

if (failures === 0) {
  console.log("\nAll smoke checks passed.")
} else {
  console.error(`\n${failures} smoke check(s) failed.`)
  process.exit(1)
}
