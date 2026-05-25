// Runtime smoke for the verified core (Node strips the TS types).
//   node test/smoke.ts
import {
  tryBook, cancel, remaining, wellFormed, confirmedCount, hasRoom,
  initPage, addSlot, setCapacity, closeSlot, capacityAt,
  replay, bookersOf, availableSlots, soldOut, type Page, type Op,
} from "../src/domain.ts"

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

// Cancelling frees the seat (reverse monotonicity + conservation). r4.page has
// alice on slot 0 (bk1) and slot 1 (bk4).
const p6 = cancel(r4.page, "bk1") // cancel alice's slot-0 booking
check(wellFormed(p6), "well-formed after cancellation")
check(confirmedCount(p6.bookings, 0) === 0, "slot 0 freed after cancel")
check(remaining(p6, 0) === 1, "remaining on freed slot 0 back to 1")
check(remaining(p6, 1) === 0, "slot 1 still full (remaining 0)")

// Bob can now grab the freed slot 0.
const r7 = tryBook(p6, 0, "bk7", "bob", 7)
check(r7.outcome === "confirmed", "a freed slot is bookable again")
check(wellFormed(r7.page), "well-formed after re-booking the freed slot")

// ── Provider mutations (Stage 1) ──────────────────────────────

// Build a page the verified way; a class with 3 seats = one slot of capacity 3.
let g = initPage("g1", "Group class", [{ label: "Sat 10am", capacity: 3 }])
check(wellFormed(g), "initPage is well-formed")

// Provider appends a second slot after publishing.
g = addSlot(g, "Sat 11am", 1)
check(wellFormed(g) && g.slots.length === 2, "addSlot appends an in-range, empty slot")

// Two people grab the 3-seat slot; one seat left.
g = tryBook(g, 0, "g-bk1", "u1", 1).page
g = tryBook(g, 0, "g-bk2", "u2", 2).page
check(confirmedCount(g.bookings, 0) === 2 && remaining(g, 0) === 1, "2 of 3 seats taken")

// Provider lowers capacity to exactly what's booked (a "close"): no oversell.
g = setCapacity(g, 0, 2)
check(wellFormed(g) && capacityAt(g.slots, 0) === 2, "setCapacity down to the booked count")
check(!hasRoom(g, 0), "the just-capped slot now has no room")

// closeSlot caps slot 1 (0 booked) at 0 — well-formed, and shut to new bookings.
g = closeSlot(g, 1)
check(wellFormed(g) && capacityAt(g.slots, 1) === 0, "closeSlot caps an empty slot at 0")
check(tryBook(g, 1, "g-bk3", "u3", 3).outcome === "full", "a closed slot rejects bookings")

// ── Op log & replay (Stage 2) ─────────────────────────────────

// The DO's authoritative model is replay over a totally-ordered op log. A
// contended slot (capacity 1) with two booking ops + a cancel: first wins,
// second is a no-op (full), then the first cancels — leaving the slot free.
const base = initPage("r1", "Replay demo", [{ label: "Only seat", capacity: 1 }])
const log: Op[] = [
  { kind: "book", idx: 0, bookingId: "r-bk1", key: "x", seq: 1 },
  { kind: "book", idx: 0, bookingId: "r-bk2", key: "y", seq: 2 }, // loses the race -> no-op
  { kind: "cancel", bookingId: "r-bk1" },
]
const rp = replay(base, log)
check(wellFormed(rp), "replayed page is well-formed (never oversold)")
check(confirmedCount(rp.bookings, 0) === 0, "winner cancelled -> slot free again")

// Re-running the same log over the same start is deterministic (audit/export).
const rp2 = replay(base, log)
check(confirmedCount(rp2.bookings, 0) === confirmedCount(rp.bookings, 0), "replay is deterministic")

// ── Queries (Stage 3) ─────────────────────────────────────────

// Two slots, capacities [2, 1]; fill slot 1, leave room in slot 0.
let q = initPage("q1", "Queries", [{ label: "A", capacity: 2 }, { label: "B", capacity: 1 }])
q = tryBook(q, 0, "q-a1", "p1", 1).page
q = tryBook(q, 1, "q-b1", "p2", 2).page

// bookersOf length matches the count exactly (the provider's "who's booked" list).
check(bookersOf(q, 0).length === confirmedCount(q.bookings, 0), "bookersOf length == count (slot 0)")
check(bookersOf(q, 1).length === 1 && bookersOf(q, 1)[0].key === "p2", "bookersOf returns the holder")

// availableSlots is the per-slot room mask; soldOut iff none has room.
check(availableSlots(q).length === 2 && availableSlots(q)[0] === true && availableSlots(q)[1] === false,
  "availableSlots mask matches hasRoom per slot")
check(soldOut(q) === false, "not sold out while slot 0 has room")

// Fill the last seat of slot 0 -> whole page sold out.
q = tryBook(q, 0, "q-a2", "p3", 3).page
check(soldOut(q) === true, "sold out once every slot is full")

if (failures === 0) {
  console.log("\nAll smoke checks passed.")
} else {
  console.error(`\n${failures} smoke check(s) failed.`)
  process.exit(1)
}
