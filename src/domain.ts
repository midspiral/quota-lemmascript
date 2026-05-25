//@ backend dafny

// ═══════════════════════════════════════════════════════════════
// Quota — verified domain core
//
// A booking page is a list of `slots` (each with a capacity) and an append-only
// list of `bookings`. Anonymous users grab slots until they're full; the core
// guarantees a page is NEVER oversold.
//
// Quota is Quorum *inverted*: where Quorum's data was partitioned per
// participant (no conflicts ⇒ optimistic, lock-free), Quota's bookings CONTEND
// for shared inventory, so the load-bearing fact is a *bound*, not a count:
//   for every slot j,  confirmedCount(bookings, j) <= slots[j].capacity.
//
// Stage 0 (this file): the safety spine.
//   • confirmedCount — the per-slot count of confirmed bookings (Quorum's
//     countFree kernel, re-pointed at bookings; total, precondition-free).
//   • withinCapacity / wellFormed — the no-overbooking invariant (A1).
//   • tryBook — accept iff there's room and this booker doesn't already hold the
//     slot (idempotent); a three-way outcome so a retry reads as success, not a
//     rejection. Only "confirmed" mutates.
//   • tryBookPreservesInv — capacity safety: a booking attempt never oversells.
//
// Style mirrors Quorum: pure recursive functions (no imperative loops), a TOTAL
// counting kernel so it composes freely, and each `//@ ensures` discharged by an
// inductive proof in the companion .dfy. Slot indices are abstract; the
// date/time/label of a slot is a concern of the (unverified) shell.
// ═══════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────

interface Slot {
  label: string      // display only (time/title); OPAQUE to the core
  capacity: number   // >= 0; product default 1. capacity 0 === "closed"
}

type BookingStatus = "confirmed" | "cancelled"

interface Booking {
  id: string         // booking id == the holder's private cancellation token
  slotIdx: number    // which slot, in [0, slots.length)
  key: string        // dedup / idempotency key (anonymous localStorage token)
  status: BookingStatus
  seq: number        // arrival order, assigned by the DO's total order
}

interface Page {
  id: string
  title: string
  slots: Slot[]          // append-only; close by lowering capacity to current count
  bookings: Booking[]    // append-only log; cancellation flips status, never removes
}

type BookOutcome = "confirmed" | "duplicate" | "full"

interface BookResult {
  outcome: BookOutcome
  page: Page
}

export type { Slot, Booking, Page, BookingStatus, BookOutcome, BookResult }

// ── Counting kernel ───────────────────────────────────────────

// Does booking `b` hold slot `idx`? — TOTAL: a hold is a confirmed booking for
// that exact index. (Quorum's freeAt analog.)
export function holds(b: Booking, idx: number): boolean {
  //@ verify
  return b.status === "confirmed" && b.slotIdx === idx
}

// The number of confirmed bookings against slot `idx`. Precondition-free
// recursive count; the spec-level count and the engine that produces it are the
// same function. (Quorum's countFree, re-pointed at bookings.)
export function confirmedCount(bs: Booking[], idx: number): number {
  //@ verify
  //@ decreases bs.length
  //@ ensures 0 <= \result && \result <= bs.length
  if (bs.length === 0) return 0
  const rest = confirmedCount(bs.slice(1), idx)
  return (holds(bs[0], idx) ? 1 : 0) + rest
}

// Capacity of slot `idx`, or 0 if out of range (TOTAL).
export function capacityAt(slots: Slot[], idx: number): number {
  //@ verify
  //@ ensures (0 <= idx && idx < slots.length) ==> \result === slots[idx].capacity
  //@ ensures !(0 <= idx && idx < slots.length) ==> \result === 0
  if (idx < 0) return 0
  if (idx >= slots.length) return 0
  return slots[idx].capacity
}

// Room at slot `idx` iff it's in range and its confirmed count is below capacity.
export function hasRoom(p: Page, idx: number): boolean {
  //@ verify
  //@ ensures \result === (0 <= idx && idx < p.slots.length && confirmedCount(p.bookings, idx) < capacityAt(p.slots, idx))
  if (idx < 0) return false
  if (idx >= p.slots.length) return false
  return confirmedCount(p.bookings, idx) < capacityAt(p.slots, idx)
}

// Does `key` already hold a confirmed booking for slot `idx`? — the
// per-(slot, booker) idempotency check. False for a booker who holds only OTHER
// slots, so multi-slot booking is unrestricted by design.
export function keyHolds(bs: Booking[], idx: number, key: string): boolean {
  //@ verify
  //@ decreases bs.length
  if (bs.length === 0) return false
  if (bs[0].status === "confirmed" && bs[0].slotIdx === idx && bs[0].key === key) return true
  return keyHolds(bs.slice(1), idx, key)
}

// ── The no-overbooking invariant (Family A) ───────────────────

// withinCapacity over the first `k` slots: every slot j in [0, k) is within
// capacity. Recurses on `k` (not by slicing slots) so booking-referenced slot
// indices stay absolute. The reflection lemma (from `ensures`) hands a caller
// the quantified per-slot bound. (Quorum's allAvailLen pattern.)
export function withinCapacityUpto(slots: Slot[], bs: Booking[], k: number): boolean {
  //@ verify
  //@ requires 0 <= k && k <= slots.length
  //@ decreases k
  //@ ensures \result === true ==> forall(j, 0 <= j && j < k ==> confirmedCount(bs, j) <= slots[j].capacity)
  if (k === 0) return true
  if (confirmedCount(bs, k - 1) > slots[k - 1].capacity) return false
  return withinCapacityUpto(slots, bs, k - 1)
}

// Completeness of the reflection: the quantified bound rebuilds the predicate.
// (Pure-carrier lemma; induction in the companion .dfy.)
export function withinCapacityUptoComplete(slots: Slot[], bs: Booking[], k: number): boolean {
  //@ verify
  //@ requires 0 <= k && k <= slots.length
  //@ requires forall(j, 0 <= j && j < k ==> confirmedCount(bs, j) <= slots[j].capacity)
  //@ decreases k
  //@ ensures withinCapacityUpto(slots, bs, k) === true
  return true
}

// A1: no slot is oversold.
export function withinCapacity(slots: Slot[], bs: Booking[]): boolean {
  //@ verify
  return withinCapacityUpto(slots, bs, slots.length)
}

export function wellFormed(p: Page): boolean {
  //@ verify
  return withinCapacity(p.slots, p.bookings)
}

// ── The booking decision (Family B) ───────────────────────────

// Appending a booking bumps exactly its own slot's count by one (if it's a
// confirmed hold there) and leaves every other slot's count fixed — the snoc
// homomorphism the safety proof rests on. (Quorum's countFreeConcat analog.)
export function confirmedCountSnoc(bs: Booking[], b: Booking, idx: number): boolean {
  //@ verify
  //@ ensures confirmedCount(bs.concat([b]), idx) === confirmedCount(bs, idx) + (holds(b, idx) ? 1 : 0)
  return true
}

// Appending a confirmed booking for an in-range slot that still has room keeps
// withinCapacityUpto: the booked slot rises by one (and was strictly under
// capacity), every other slot is unchanged. (Pure-carrier; induction in .dfy.)
export function withinCapacityUptoAppend(slots: Slot[], bs: Booking[], b: Booking, k: number): boolean {
  //@ verify
  //@ requires 0 <= k && k <= slots.length
  //@ requires withinCapacityUpto(slots, bs, k) === true
  //@ requires (0 <= b.slotIdx && b.slotIdx < slots.length) ==> confirmedCount(bs, b.slotIdx) < slots[b.slotIdx].capacity
  //@ decreases k
  //@ ensures withinCapacityUpto(slots, bs.concat([b]), k) === true
  return true
}

// The headline transition. A three-way verdict so the shell can tell a happy
// retry from a real "sold out":
//   • "confirmed" — a NEW seat was appended (room, and not already held).
//   • "duplicate" — this booker already holds this slot; idempotent success,
//                   page unchanged (a double-click / reconnect lands here).
//   • "full"      — no room (or no such slot); page unchanged.
// Only "confirmed" mutates. A booker holding OTHER slots never affects this.
export function tryBook(p: Page, idx: number, bookingId: string, key: string, seq: number): BookResult {
  //@ verify
  //@ ensures \result.page.slots === p.slots
  //@ ensures (\result.outcome === "duplicate") === keyHolds(p.bookings, idx, key)
  //@ ensures (\result.outcome === "confirmed") === (!keyHolds(p.bookings, idx, key) && hasRoom(p, idx))
  //@ ensures (\result.outcome === "confirmed") || (\result.page === p)
  if (keyHolds(p.bookings, idx, key)) return { outcome: "duplicate", page: p }
  if (!hasRoom(p, idx)) return { outcome: "full", page: p }
  const b: Booking = { id: bookingId, slotIdx: idx, key: key, status: "confirmed", seq: seq }
  return { outcome: "confirmed", page: { ...p, bookings: [...p.bookings, b] } }
}

// Capacity safety: a booking attempt NEVER oversells — for any outcome the
// resulting page is still well-formed.
export function tryBookPreservesInv(p: Page, idx: number, bookingId: string, key: string, seq: number): boolean {
  //@ verify
  //@ requires wellFormed(p)
  //@ ensures wellFormed(tryBook(p, idx, bookingId, key, seq).page)
  return true
}

// ── Conservation & cancellation (Stage 0b / Family C) ─────────

// Cancel the booking whose id === bookingId: flip its status to "cancelled".
// The log is append-only — we never remove a row, only flip its status — so the
// length is unchanged (and replay/audit stays faithful).
export function cancelById(bs: Booking[], bookingId: string): Booking[] {
  //@ verify
  //@ decreases bs.length
  //@ ensures \result.length === bs.length
  if (bs.length === 0) return []
  if (bs[0].id === bookingId) return [{ ...bs[0], status: "cancelled" }, ...bs.slice(1)]
  return [bs[0], ...cancelById(bs.slice(1), bookingId)]
}

// C: cancelling never RAISES a slot's count — it frees a seat or leaves it
// untouched (reverse monotonicity). Proof by induction on bs. (Pure-carrier.)
export function cancelMonotone(bs: Booking[], bookingId: string, idx: number): boolean {
  //@ verify
  //@ decreases bs.length
  //@ ensures confirmedCount(cancelById(bs, bookingId), idx) <= confirmedCount(bs, idx)
  return true
}

// A cancellation preserves the no-overbooking invariant: every count only goes
// down, so each stays within capacity. (Reverse-monotone ⇒ trivially safe.)
export function cancel(p: Page, bookingId: string): Page {
  //@ verify
  //@ requires wellFormed(p)
  //@ ensures wellFormed(\result)
  //@ ensures \result.slots === p.slots
  return { ...p, bookings: cancelById(p.bookings, bookingId) }
}

// Conservation: remaining seats + confirmed bookings === capacity, and on a
// well-formed page (where no slot is oversold) the remainder is never negative.
export function remaining(p: Page, idx: number): number {
  //@ verify
  //@ requires wellFormed(p)
  //@ requires 0 <= idx && idx < p.slots.length
  //@ ensures \result + confirmedCount(p.bookings, idx) === capacityAt(p.slots, idx)
  //@ ensures \result >= 0
  return capacityAt(p.slots, idx) - confirmedCount(p.bookings, idx)
}
