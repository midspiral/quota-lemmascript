// The only caller of the verified READ functions. Components render what these
// return; no counting/capacity/decision logic lives in the UI.
import { useSyncExternalStore } from "react"
import type { PageStore } from "./store"
import type { Auth, Session } from "./auth"
import type { Booking } from "./domain"
import { availableSlots, soldOut, remaining, bookersOf, capacityAt, confirmedCount } from "./domain"

export function usePage(store: PageStore) {
  const page = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const available = availableSlots(page) // verified per-slot room mask
  return {
    page,
    available,
    isSoldOut: soldOut(page), // verified
    remainingOf: (i: number): number => remaining(page, i), // verified (page well-formed, i in range)
    capacityOf: (i: number): number => capacityAt(page.slots, i),
    confirmedOf: (i: number): number => confirmedCount(page.bookings, i),
    bookersOf: (i: number): Booking[] => bookersOf(page, i), // verified: length === the count
    book: store.book,
    cancel: store.cancel,
    addSlot: store.addSlot,
    setCapacity: store.setCapacity,
    closeSlot: store.closeSlot,
  }
}

export function useSession(auth: Auth): Session | null {
  return useSyncExternalStore(auth.subscribe, auth.current)
}
