// The per-page store seam. The ONLY module that imports the mutating domain
// functions. LocalStore persists one verified Page to localStorage; a future
// RemoteStore (Cloudflare Durable Object) implements the same interface, so the
// UI is unchanged. Booking is fallible + async-shaped from day one.
import type { Page, BookOutcome } from "./domain"
import {
  tryBook,
  cancel as cancelBooking,
  addSlot as addSlotFn,
  setCapacity as setCapacityFn,
  closeSlot as closeSlotFn,
  confirmedCount,
} from "./domain"
import { load, save, pageKey, uid } from "./persist"

export interface PageStore {
  getSnapshot(): Page | null // null while a RemoteStore loads its first state
  subscribe(fn: () => void): () => void
  // booking side (anonymous, contended, fallible — returns the authoritative outcome)
  book(slotIdx: number, key: string): Promise<{ outcome: BookOutcome; bookingId: string }>
  cancel(bookingId: string): Promise<void>
  // provider side (management)
  addSlot(label: string, capacity: number): Promise<void>
  setCapacity(slotIdx: number, capacity: number): Promise<void>
  closeSlot(slotIdx: number): Promise<void>
}

export function createLocalStore(pageId: string): PageStore {
  const loaded = load<Page | null>(pageKey(pageId), null)
  if (loaded === null) throw new Error(`No such page: ${pageId}`)
  let page: Page = loaded

  const subs = new Set<() => void>()
  const commit = (next: Page): void => {
    page = next
    save(pageKey(pageId), page)
    subs.forEach((f) => f())
  }

  return {
    getSnapshot: () => page,
    subscribe(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    async book(slotIdx, key) {
      const bookingId = uid()
      // verified: never oversells; outcome is exactly accept-iff-room (+ idempotent retry)
      const r = tryBook(page, slotIdx, bookingId, key, Date.now())
      commit(r.page)
      return { outcome: r.outcome, bookingId }
    },
    async cancel(bookingId) {
      commit(cancelBooking(page, bookingId)) // verified: only frees seats
    },
    async addSlot(label, capacity) {
      commit(addSlotFn(page, label, Math.max(0, capacity)))
    },
    async setCapacity(slotIdx, capacity) {
      // verified precondition: can't drop below what's already booked — enforce the floor
      const floor = confirmedCount(page.bookings, slotIdx)
      commit(setCapacityFn(page, slotIdx, Math.max(floor, capacity)))
    },
    async closeSlot(slotIdx) {
      commit(closeSlotFn(page, slotIdx))
    },
  }
}
