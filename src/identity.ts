// Anonymous booker identity (no login) + "your bookings" per device, so a refresh
// doesn't double-book and you can cancel your own bookings. The same key is sent
// on connect in the Cloudflare version.
import { load, save, uid } from "./persist"

const ME = "quota:me"

interface Me {
  key: string
  bookings: Record<string, string[]> // pageId -> bookingIds
}

function me(): Me {
  return load<Me>(ME, { key: "", bookings: {} })
}

export function myKey(): string {
  const m = me()
  if (m.key === "") {
    m.key = uid()
    save(ME, m)
  }
  return m.key
}

export function myBookings(pageId: string): string[] {
  return me().bookings[pageId] ?? []
}

export function rememberBooking(pageId: string, bookingId: string): void {
  const m = me()
  const list = m.bookings[pageId] ?? []
  if (!list.includes(bookingId)) {
    m.bookings[pageId] = [...list, bookingId]
    save(ME, m)
  }
}

export function forgetBooking(pageId: string, bookingId: string): void {
  const m = me()
  const list = m.bookings[pageId] ?? []
  m.bookings[pageId] = list.filter((b) => b !== bookingId)
  save(ME, m)
}
