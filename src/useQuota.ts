// Hooks the UI uses. usePage is null-safe (a RemoteStore loads async); the
// registry hooks load async and work for both local and remote catalogs.
import { useEffect, useState, useSyncExternalStore } from "react"
import { catalog } from "./config"
import type { PageStore } from "./store"
import type { Auth, Session } from "./auth"
import type { Booking, Page } from "./domain"
import type { PageRef, BookerInfo } from "./catalog"
import { availableSlots, soldOut, remaining, bookersOf, capacityAt, confirmedCount } from "./domain"

// The verified READ functions, guarded for the loading (null) snapshot.
export function usePage(store: PageStore) {
  const page = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return {
    page, // Page | null
    available: page === null ? [] : availableSlots(page),
    isSoldOut: page === null ? false : soldOut(page),
    remainingOf: (i: number): number => (page === null ? 0 : remaining(page, i)),
    capacityOf: (i: number): number => (page === null ? 0 : capacityAt(page.slots, i)),
    confirmedOf: (i: number): number => (page === null ? 0 : confirmedCount(page.bookings, i)),
    bookersOf: (i: number): Booking[] => (page === null ? [] : bookersOf(page, i)),
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

export function useMyPages(handle: string): { loading: boolean; pages: PageRef[] } {
  const [state, setState] = useState<{ loading: boolean; pages: PageRef[] }>({ loading: true, pages: [] })
  useEffect(() => {
    let active = true
    void catalog.listPages(handle).then((pages) => active && setState({ loading: false, pages }))
    return () => {
      active = false
    }
  }, [handle])
  return state
}

export function usePageRef(username: string, pagename: string): { loading: boolean; ref: PageRef | null } {
  const [state, setState] = useState<{ loading: boolean; ref: PageRef | null }>({ loading: true, ref: null })
  useEffect(() => {
    let active = true
    void catalog.resolve(username, pagename).then((ref) => active && setState({ loading: false, ref }))
    return () => {
      active = false
    }
  }, [username, pagename])
  return state
}

// Booker names (provider view). Re-fetches whenever the page snapshot changes.
export function useBookers(pageId: string, page: Page | null): BookerInfo[] {
  const [bookers, setBookers] = useState<BookerInfo[]>([])
  useEffect(() => {
    let active = true
    void catalog.bookers(pageId).then((b) => active && setBookers(b))
    return () => {
      active = false
    }
  }, [pageId, page])
  return bookers
}
