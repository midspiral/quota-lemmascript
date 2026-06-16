# Guarantees: src/domain.ts

Generated: 2026-06-16

> Verification is **assumed** (run `lsc check` to discharge the proofs). This report vets only that each `//@ contract` faithfully describes its formal `requires`/`ensures`, via claimcheck's blind round-trip.

## Coverage

- **43** backed contracts: 43 confirmed, 0 disputed
- **0** gaps (contract with no formal spec behind it)

## Claimcheck Results

| Function | Contract | Status |
|----------|----------|--------|
| `confirmedCount` | A count between 0 and the number of bookings. | ✅ confirmed |
| `capacityAt` | The capacity of slot idx, or 0 if idx is out of range. | ✅ confirmed |
| `hasRoom` | True exactly when slot idx is in range and its confirmed count is below its capacity. | ✅ confirmed |
| `withinCapacityUpto` | Returns true only when each of the first k slots is within its capacity (sound; the converse is the separate completeness lemma). | ✅ confirmed |
| `withinCapacityUptoComplete` | If every one of the first k slots is within its capacity, the within-capacity check returns true (completeness). | ✅ confirmed |
| `confirmedCountSnoc` | Appending a booking raises slot idx's confirmed count by one if that booking holds the slot, and leaves it unchanged otherwise. | ✅ confirmed |
| `withinCapacityUptoAppend` | Appending a booking to a within-capacity list keeps it within capacity, provided that slot still had room. | ✅ confirmed |
| `tryBook` | Honest accept/reject: the result is "duplicate" exactly when this key already booked the slot, "confirmed" exactly when it is not a duplicate and the slot has room, and the page is left unchanged unless it confirms. | ✅ confirmed |
| `tryBookPreservesInv` | A booking attempt on a well-formed page never oversells — the resulting page is still well-formed for any outcome. | ✅ confirmed |
| `cancelById` | A booking list of the same length as the input (the append-only log never shrinks). | ✅ confirmed |
| `cancelMonotone` | Cancelling a booking never raises any slot's confirmed count. | ✅ confirmed |
| `cancel` | A well-formed page with the same slots; the cancellation itself is not part of the proven contract. | ✅ confirmed |
| `remaining` | The seats left at slot idx — it plus the confirmed count equal the capacity, and it is never negative. | ✅ confirmed |
| `allInRange` | Returns true only when every booking's slot index lies in the range [0, n) (the sound direction). | ✅ confirmed |
| `allInRangeSnoc` | Appending an in-range booking keeps every booking's slot index in range. | ✅ confirmed |
| `allInRangeCancel` | Cancelling a booking keeps every remaining booking's slot index in range. | ✅ confirmed |
| `allInRangeWiden` | If every booking's slot index is below n, it is also below any larger bound m. | ✅ confirmed |
| `countZeroAtUnbooked` | A slot index at or beyond the booked range has a confirmed count of zero — a freshly added slot starts empty. | ✅ confirmed |
| `initPage` | A well-formed page with the given slots; that it starts empty is not part of the proven contract. | ✅ confirmed |
| `addSlot` | A well-formed page; the slot addition itself is not part of the proven contract. | ✅ confirmed |
| `setCapAt` | Sets slot idx's capacity to newCap, leaving every other slot unchanged. | ✅ confirmed |
| `setCapacity` | A well-formed page with the same number of slots; the capacity change itself is not part of the proven contract. | ✅ confirmed |
| `closeSlot` | A well-formed page; the slot closure itself is not part of the proven contract. | ✅ confirmed |
| `applyOp` | A page with the same slots; the op's effect on the bookings is not part of the proven contract. | ✅ confirmed |
| `applyOpPreservesInv` | Applying any op to a well-formed page yields a well-formed page — no op log can produce an oversold page. | ✅ confirmed |
| `replayPreservesInv` | Replaying any op log over a well-formed page yields a well-formed page — every reachable state stays within capacity. | ✅ confirmed |
| `confirmedCountConcat` | The confirmed count over two concatenated booking lists equals the sum of their counts — additive over concatenation. | ✅ confirmed |
| `confirmedCountComm` | A slot's confirmed count is the same whichever order two booking lists are concatenated. | ✅ confirmed |
| `confirmedBookers` | A list whose length equals slot idx's confirmed count. | ✅ confirmed |
| `bookersOf` | A list whose length equals slot idx's confirmed count on the page. | ✅ confirmed |
| `availableUpto` | Marks, per slot, exactly which of the first k slots still have room. | ✅ confirmed |
| `availableSlots` | Marks, per slot, exactly which slots still have room. | ✅ confirmed |
| `noneAvailUpto` | True exactly when none of the first k slots has room. | ✅ confirmed |
| `soldOut` | True exactly when no slot has any room left. | ✅ confirmed |
| `confirmedOnlyPreservesCount` | Dropping the cancelled bookings never changes any slot's confirmed count. | ✅ confirmed |
| `exportPage` | A page with the same slots; that only confirmed bookings are kept is not part of the proven contract. | ✅ confirmed |
| `availableSlotsOverExport` | Availability is identical over the exported page and the live page — a query over the export gives the same answer the booker saw. | ✅ confirmed |
| `keyHoldsSnoc` | Appending a booking adds exactly the (slot, key) it confirms to the "already holds" set, and nothing else. | ✅ confirmed |
| `bookDelta` | A single booking attempt raises slot s's count by one exactly when it is accepted (not a duplicate, has room) and targets s; otherwise it leaves the count unchanged. | ✅ confirmed |
| `keyHoldsAfterBook` | After a booking attempt, the (slot, key) set gains (idx, key) exactly when the attempt was accepted there. | ✅ confirmed |
| `bookCountOrderInvariant` | Two booking attempts applied in either order leave every slot's confirmed count identical — even when they contend for the same slot — so availability is order-independent. | ✅ confirmed |
| `confirmedCountPerm` | Any permutation of the booking log leaves every slot's confirmed count unchanged. | ✅ confirmed |
| `hasRoomPermInvariant` | Two pages with the same slots whose booking logs are permutations of each other agree on whether each slot has room. | ✅ confirmed |

## Confirmed Guarantees

**A count between 0 and the number of bookings.** — `confirmedCount`
```
confirmedCount(bs: Booking[], idx: number): number
  ensures 0 <= \result && \result <= bs.length
```
- Back-translation: The confirmed count of bookings at a given index is a non-negative integer that does not exceed the length of the bookings array.

**The capacity of slot idx, or 0 if idx is out of range.** — `capacityAt`
```
capacityAt(slots: Slot[], idx: number): number
  ensures (0 <= idx && idx < slots.length) ==> \result === slots[idx].capacity
  ensures !(0 <= idx && idx < slots.length) ==> \result === 0
```
- Back-translation: The capacity at a given index is either the capacity of the slot at that index (if the index is valid), or 0 (if the index is out of bounds).

**True exactly when slot idx is in range and its confirmed count is below its capacity.** — `hasRoom`
```
hasRoom(p: Page, idx: number): boolean
  ensures \result === (0 <= idx && idx < p.slots.length && confirmedCount(p.bookings, idx) < capacityAt(p.slots, idx))
```
- Back-translation: A page has room at a given index if and only if the index is valid, the index is within the slots array bounds, and the confirmed count at that index is strictly less than the capacity at that index.

**Returns true only when each of the first k slots is within its capacity (sound; the converse is the separate completeness lemma).** — `withinCapacityUpto`
```
withinCapacityUpto(slots: Slot[], bs: Booking[], k: number): boolean
  requires 0 <= k && k <= slots.length
  ensures \result === true ==> forall(j, 0 <= j && j < k ==> confirmedCount(bs, j) <= slots[j].capacity)
```
- Back-translation: For all slots up to index k, if the function returns true, then the confirmed count at each slot does not exceed that slot's capacity.

**If every one of the first k slots is within its capacity, the within-capacity check returns true (completeness).** — `withinCapacityUptoComplete`
```
withinCapacityUptoComplete(slots: Slot[], bs: Booking[], k: number): boolean
  requires 0 <= k && k <= slots.length
  requires forall(j, 0 <= j && j < k ==> confirmedCount(bs, j) <= slots[j].capacity)
  ensures withinCapacityUpto(slots, bs, k) === true
```
- Back-translation: If the confirmed count at each slot up to index k is already within capacity, then the withinCapacityUpto function returns true.

**Appending a booking raises slot idx's confirmed count by one if that booking holds the slot, and leaves it unchanged otherwise.** — `confirmedCountSnoc`
```
confirmedCountSnoc(bs: Booking[], b: Booking, idx: number): boolean
  ensures confirmedCount(bs.concat([b]), idx) === confirmedCount(bs, idx) + (holds(b, idx) ? 1 : 0)
```
- Back-translation: When a booking is appended to the bookings array, the confirmed count at a given index increases by 1 if the booking holds at that index, and remains unchanged otherwise.

**Appending a booking to a within-capacity list keeps it within capacity, provided that slot still had room.** — `withinCapacityUptoAppend`
```
withinCapacityUptoAppend(slots: Slot[], bs: Booking[], b: Booking, k: number): boolean
  requires 0 <= k && k <= slots.length
  requires withinCapacityUpto(slots, bs, k) === true
  requires (0 <= b.slotIdx && b.slotIdx < slots.length) ==> confirmedCount(bs, b.slotIdx) < slots[b.slotIdx].capacity
  ensures withinCapacityUpto(slots, bs.concat([b]), k) === true
```
- Back-translation: If bookings are within capacity up to index k, and a new booking does not exceed the capacity of its slot, then the bookings remain within capacity up to index k after appending the new booking.

**Honest accept/reject: the result is "duplicate" exactly when this key already booked the slot, "confirmed" exactly when it is not a duplicate and the slot has room, and the page is left unchanged unless it confirms.** — `tryBook`
```
tryBook(p: Page, idx: number, bookingId: string, key: string, seq: number): BookResult
  ensures \result.page.slots === p.slots
  ensures (\result.outcome === "duplicate") === keyHolds(p.bookings, idx, key)
  ensures (\result.outcome === "confirmed") === (!keyHolds(p.bookings, idx, key) && hasRoom(p, idx))
  ensures (\result.outcome === "confirmed") || (\result.page === p)
```
- Back-translation: Attempting to book a slot returns a result with the same slots as the original page. The outcome is 'duplicate' if and only if the key already holds at that index. The outcome is 'confirmed' if and only if the key does not hold and there is room. If the outcome is not 'confirmed', the page is unchanged.

**A booking attempt on a well-formed page never oversells — the resulting page is still well-formed for any outcome.** — `tryBookPreservesInv`
```
tryBookPreservesInv(p: Page, idx: number, bookingId: string, key: string, seq: number): boolean
  requires wellFormed(p)
  ensures wellFormed(tryBook(p, idx, bookingId, key, seq).page)
```
- Back-translation: If a page is well-formed before attempting to book, the resulting page remains well-formed after the booking attempt.

**A booking list of the same length as the input (the append-only log never shrinks).** — `cancelById`
```
cancelById(bs: Booking[], bookingId: string): Booking[]
  ensures \result.length === bs.length
```
- Back-translation: Canceling a booking by ID returns a bookings array with the same length as the original array.

**Cancelling a booking never raises any slot's confirmed count.** — `cancelMonotone`
```
cancelMonotone(bs: Booking[], bookingId: string, idx: number): boolean
  ensures confirmedCount(cancelById(bs, bookingId), idx) <= confirmedCount(bs, idx)
```
- Back-translation: Canceling a booking by ID does not increase the confirmed count at any index; it can only decrease or maintain it.

**A well-formed page with the same slots; the cancellation itself is not part of the proven contract.** — `cancel`
```
cancel(p: Page, bookingId: string): Page
  requires wellFormed(p)
  ensures wellFormed(\result)
  ensures \result.slots === p.slots
```
- Back-translation: Canceling a booking by ID on a well-formed page results in a well-formed page with the same slots.

**The seats left at slot idx — it plus the confirmed count equal the capacity, and it is never negative.** — `remaining`
```
remaining(p: Page, idx: number): number
  requires wellFormed(p)
  requires 0 <= idx && idx < p.slots.length
  ensures \result + confirmedCount(p.bookings, idx) === capacityAt(p.slots, idx)
  ensures \result >= 0
```
- Back-translation: The remaining capacity at a given index equals the slot's capacity minus the confirmed count at that index, and is non-negative.

**Returns true only when every booking's slot index lies in the range [0, n) (the sound direction).** — `allInRange`
```
allInRange(bs: Booking[], n: number): boolean
  ensures \result === true ==> forall(i, 0 <= i && i < bs.length ==> 0 <= bs[i].slotIdx && bs[i].slotIdx < n)
```
- Back-translation: If the function returns true, then all bookings have slot indices within the range [0, n).

**Appending an in-range booking keeps every booking's slot index in range.** — `allInRangeSnoc`
```
allInRangeSnoc(bs: Booking[], b: Booking, n: number): boolean
  requires allInRange(bs, n)
  requires 0 <= b.slotIdx && b.slotIdx < n
  ensures allInRange(bs.concat([b]), n)
```
- Back-translation: If all bookings are in range [0, n) and a new booking with slot index in [0, n) is appended, then all bookings in the concatenated array are in range [0, n).

**Cancelling a booking keeps every remaining booking's slot index in range.** — `allInRangeCancel`
```
allInRangeCancel(bs: Booking[], bookingId: string, n: number): boolean
  requires allInRange(bs, n)
  ensures allInRange(cancelById(bs, bookingId), n)
```
- Back-translation: If all bookings are in range [0, n), then after canceling a booking by ID, all remaining bookings are still in range [0, n).

**If every booking's slot index is below n, it is also below any larger bound m.** — `allInRangeWiden`
```
allInRangeWiden(bs: Booking[], n: number, m: number): boolean
  requires allInRange(bs, n)
  requires n <= m
  ensures allInRange(bs, m)
```
- Back-translation: If all bookings are in range [0, n) and n is less than or equal to m, then all bookings are also in range [0, m).

**A slot index at or beyond the booked range has a confirmed count of zero — a freshly added slot starts empty.** — `countZeroAtUnbooked`
```
countZeroAtUnbooked(bs: Booking[], n: number, idx: number): boolean
  requires allInRange(bs, n)
  requires idx >= n
  ensures confirmedCount(bs, idx) === 0
```
- Back-translation: If all bookings are in range [0, n) and the index is at or beyond n, then the confirmed count at that index is 0.

**A well-formed page with the given slots; that it starts empty is not part of the proven contract.** — `initPage`
```
initPage(id: string, title: string, slots: Slot[]): Page
  requires forall(j, 0 <= j && j < slots.length ==> slots[j].capacity >= 0)
  ensures wellFormed(\result)
  ensures \result.slots === slots
```
- Back-translation: Initializing a page with non-negative slot capacities results in a well-formed page with the specified slots.

**A well-formed page; the slot addition itself is not part of the proven contract.** — `addSlot`
```
addSlot(p: Page, label: string, newCap: number): Page
  requires wellFormed(p)
  requires newCap >= 0
  ensures wellFormed(\result)
```
- Back-translation: Adding a slot with non-negative capacity to a well-formed page results in a well-formed page.

**Sets slot idx's capacity to newCap, leaving every other slot unchanged.** — `setCapAt`
```
setCapAt(slots: Slot[], idx: number, newCap: number): Slot[]
  ensures \result.length === slots.length
  ensures forall(j, 0 <= j && j < slots.length && j !== idx ==> \result[j] === slots[j])
  ensures (0 <= idx && idx < slots.length) ==> \result[idx].capacity === newCap
```
- Back-translation: Setting the capacity at a given index produces an array with the same length, where the slot at the index has the new capacity and all other slots are unchanged.

**A well-formed page with the same number of slots; the capacity change itself is not part of the proven contract.** — `setCapacity`
```
setCapacity(p: Page, idx: number, newCap: number): Page
  requires wellFormed(p)
  requires 0 <= idx && idx < p.slots.length
  requires newCap >= confirmedCount(p.bookings, idx)
  ensures wellFormed(\result)
  ensures \result.slots.length === p.slots.length
```
- Back-translation: Setting the capacity at a given index on a well-formed page to a value at least as large as the confirmed count results in a well-formed page with the same number of slots.

**A well-formed page; the slot closure itself is not part of the proven contract.** — `closeSlot`
```
closeSlot(p: Page, idx: number): Page
  requires wellFormed(p)
  requires 0 <= idx && idx < p.slots.length
  ensures wellFormed(\result)
```
- Back-translation: Closing a slot on a well-formed page results in a well-formed page.

**A page with the same slots; the op's effect on the bookings is not part of the proven contract.** — `applyOp`
```
applyOp(p: Page, op: Op): Page
  ensures \result.slots === p.slots
```
- Back-translation: Applying an operation to a page results in a page with the same slots as the original.

**Applying any op to a well-formed page yields a well-formed page — no op log can produce an oversold page.** — `applyOpPreservesInv`
```
applyOpPreservesInv(p: Page, op: Op): boolean
  requires wellFormed(p)
  ensures wellFormed(applyOp(p, op))
```
- Back-translation: Applying an operation to a well-formed page results in a well-formed page.

**Replaying any op log over a well-formed page yields a well-formed page — every reachable state stays within capacity.** — `replayPreservesInv`
```
replayPreservesInv(p: Page, ops: Op[]): boolean
  requires wellFormed(p)
  ensures wellFormed(replay(p, ops))
```
- Back-translation: Replaying a sequence of operations on a well-formed page results in a well-formed page.

**The confirmed count over two concatenated booking lists equals the sum of their counts — additive over concatenation.** — `confirmedCountConcat`
```
confirmedCountConcat(xs: Booking[], ys: Booking[], idx: number): boolean
  ensures confirmedCount(xs.concat(ys), idx) === confirmedCount(xs, idx) + confirmedCount(ys, idx)
```
- Back-translation: The confirmed count at a given index in a concatenated bookings array equals the sum of the confirmed counts at that index in each of the two original arrays.

**A slot's confirmed count is the same whichever order two booking lists are concatenated.** — `confirmedCountComm`
```
confirmedCountComm(xs: Booking[], ys: Booking[], idx: number): boolean
  ensures confirmedCount(xs.concat(ys), idx) === confirmedCount(ys.concat(xs), idx)
```
- Back-translation: The confirmed count at a given index is the same regardless of the order in which two bookings arrays are concatenated.

**A list whose length equals slot idx's confirmed count.** — `confirmedBookers`
```
confirmedBookers(bs: Booking[], idx: number): Booking[]
  ensures \result.length === confirmedCount(bs, idx)
```
- Back-translation: The array of confirmed bookings at a given index has length equal to the confirmed count at that index.

**A list whose length equals slot idx's confirmed count on the page.** — `bookersOf`
```
bookersOf(p: Page, idx: number): Booking[]
  ensures \result.length === confirmedCount(p.bookings, idx)
```
- Back-translation: The array of bookers at a given index has length equal to the confirmed count at that index.

**Marks, per slot, exactly which of the first k slots still have room.** — `availableUpto`
```
availableUpto(p: Page, k: number): boolean[]
  requires 0 <= k && k <= p.slots.length
  ensures \result.length === k
  ensures forall(j, 0 <= j && j < k ==> \result[j] === hasRoom(p, j))
```
- Back-translation: The availability array up to index k has length k, where each element indicates whether there is room at that index.

**Marks, per slot, exactly which slots still have room.** — `availableSlots`
```
availableSlots(p: Page): boolean[]
  ensures \result.length === p.slots.length
  ensures forall(j, 0 <= j && j < p.slots.length ==> \result[j] === hasRoom(p, j))
```
- Back-translation: The availability array has length equal to the number of slots, where each element indicates whether there is room at that index.

**True exactly when none of the first k slots has room.** — `noneAvailUpto`
```
noneAvailUpto(p: Page, k: number): boolean
  requires 0 <= k && k <= p.slots.length
  ensures \result === forall(j, 0 <= j && j < k ==> !hasRoom(p, j))
```
- Back-translation: The function returns true if and only if there is no room at any index from 0 to k (exclusive).

**True exactly when no slot has any room left.** — `soldOut`
```
soldOut(p: Page): boolean
  ensures \result === forall(j, 0 <= j && j < p.slots.length ==> !hasRoom(p, j))
```
- Back-translation: The function returns true if and only if there is no room at any slot in the page.

**Dropping the cancelled bookings never changes any slot's confirmed count.** — `confirmedOnlyPreservesCount`
```
confirmedOnlyPreservesCount(bs: Booking[], idx: number): boolean
  ensures confirmedCount(confirmedOnly(bs), idx) === confirmedCount(bs, idx)
```
- Back-translation: Filtering bookings to only confirmed ones does not change the confirmed count at any index.

**A page with the same slots; that only confirmed bookings are kept is not part of the proven contract.** — `exportPage`
```
exportPage(p: Page): Page
  ensures \result.slots === p.slots
```
- Back-translation: Exporting a page results in a page with the same slots as the original.

**Availability is identical over the exported page and the live page — a query over the export gives the same answer the booker saw.** — `availableSlotsOverExport`
```
availableSlotsOverExport(p: Page): boolean
  ensures availableSlots(exportPage(p)).length === p.slots.length
  ensures availableSlots(p).length === p.slots.length
  ensures forall(j, 0 <= j && j < p.slots.length ==> availableSlots(exportPage(p))[j] === availableSlots(p)[j])
```
- Back-translation: The availability arrays of the exported page and the original page have the same length and the same values at each index.

**Appending a booking adds exactly the (slot, key) it confirms to the "already holds" set, and nothing else.** — `keyHoldsSnoc`
```
keyHoldsSnoc(bs: Booking[], b: Booking, idx: number, key: string): boolean
  ensures keyHolds(bs.concat([b]), idx, key) === (keyHolds(bs, idx, key) || (b.status === "confirmed" && b.slotIdx === idx && b.key === key))
```
- Back-translation: A key holds at an index in a concatenated bookings array if it held in the original array or if the appended booking is confirmed at that index with that key.

**A single booking attempt raises slot s's count by one exactly when it is accepted (not a duplicate, has room) and targets s; otherwise it leaves the count unchanged.** — `bookDelta`
```
bookDelta(p: Page, idx: number, bookingId: string, key: string, seq: number, s: number): boolean
  ensures confirmedCount(tryBook(p, idx, bookingId, key, seq).page.bookings, s) === confirmedCount(p.bookings, s) + ((!keyHolds(p.bookings, idx, key) && hasRoom(p, idx) && idx === s) ? 1 : 0)
```
- Back-translation: After attempting to book, the confirmed count at a given index increases by 1 if the booking succeeds at that index, and remains unchanged otherwise.

**After a booking attempt, the (slot, key) set gains (idx, key) exactly when the attempt was accepted there.** — `keyHoldsAfterBook`
```
keyHoldsAfterBook(p: Page, idx: number, bookingId: string, key: string, seq: number, s: number, k: string): boolean
  ensures keyHolds(tryBook(p, idx, bookingId, key, seq).page.bookings, s, k) === (keyHolds(p.bookings, s, k) || (!keyHolds(p.bookings, idx, key) && hasRoom(p, idx) && idx === s && key === k))
```
- Back-translation: A key holds at an index after attempting to book if it held before or if the booking succeeds at that index with that key.

**Two booking attempts applied in either order leave every slot's confirmed count identical — even when they contend for the same slot — so availability is order-independent.** — `bookCountOrderInvariant`
```
bookCountOrderInvariant(p: Page, i1: number, id1: string, k1: string, q1: number, i2: number, id2: string, k2: string, q2: number, s: number): boolean
  ensures confirmedCount(tryBook(tryBook(p, i1, id1, k1, q1).page, i2, id2, k2, q2).page.bookings, s) === confirmedCount(tryBook(tryBook(p, i2, id2, k2, q2).page, i1, id1, k1, q1).page.bookings, s)
```
- Back-translation: The confirmed count at a given index is the same regardless of the order in which two bookings are attempted.

**Any permutation of the booking log leaves every slot's confirmed count unchanged.** — `confirmedCountPerm`
```
confirmedCountPerm(xs: Booking[], ys: Booking[], idx: number): boolean
  requires perm(xs, ys)
  ensures confirmedCount(xs, idx) === confirmedCount(ys, idx)
```
- Back-translation: If two bookings arrays are permutations of each other, the confirmed count at any index is the same in both arrays.

**Two pages with the same slots whose booking logs are permutations of each other agree on whether each slot has room.** — `hasRoomPermInvariant`
```
hasRoomPermInvariant(a: Page, b: Page, idx: number): boolean
  requires a.slots === b.slots
  requires perm(a.bookings, b.bookings)
  ensures hasRoom(a, idx) === hasRoom(b, idx)
```
- Back-translation: If two pages have the same slots and their bookings are permutations of each other, then the availability at any index is the same in both pages.

