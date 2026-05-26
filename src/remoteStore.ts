// RemoteStore: the PageStore seam talking to the page's Durable Object. Booking
// is pessimistic (await the DO's authoritative outcome); a WebSocket "changed"
// ping triggers a re-fetch of the (per-viewer redacted) state for live
// availability. Same interface as LocalStore — the UI is unchanged.
import type { Page, BookOutcome } from "./domain"
import type { PageStore } from "./store"
import { apiGet, apiPost } from "./api"

export function createRemoteStore(pageId: string): PageStore {
  let page: Page | null = null
  const subs = new Set<() => void>()
  const notify = (): void => subs.forEach((f) => f())

  async function refresh(): Promise<void> {
    const r = await apiGet<{ page: Page }>(`/api/pages/${pageId}/state`)
    if (r.data?.page != null) {
      page = r.data.page
      notify()
    }
  }

  let ws: WebSocket | null = null
  let closed = false
  function connect(): void {
    if (closed) return
    try {
      const url = `${location.origin.replace(/^http/, "ws")}/api/pages/${pageId}/ws`
      ws = new WebSocket(url)
      ws.onmessage = () => void refresh()
      ws.onclose = () => {
        ws = null
        if (!closed) setTimeout(connect, 2000)
      }
    } catch {
      /* WS unavailable — pessimistic responses still keep this client correct */
    }
  }

  void refresh()
  connect()

  return {
    getSnapshot: () => page,
    subscribe(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
        if (subs.size === 0) {
          closed = true
          ws?.close()
        }
      }
    },
    async book(slotIdx, _key) {
      // identity comes from the auth token server-side; _key is ignored remotely
      const r = await apiPost<{ outcome: BookOutcome; bookingId: string; page: Page }>(
        `/api/pages/${pageId}/book`,
        { slotIdx },
      )
      if (r.status !== 200 || r.data === null) return { outcome: "full", bookingId: "" }
      page = r.data.page
      notify()
      return { outcome: r.data.outcome, bookingId: r.data.bookingId }
    },
    async cancel(bookingId) {
      const r = await apiPost<{ page: Page }>(`/api/pages/${pageId}/cancel`, { bookingId })
      if (r.data?.page != null) {
        page = r.data.page
        notify()
      }
    },
    async addSlot(label, capacity) {
      await apiPost(`/api/pages/${pageId}/slots`, { label, capacity })
      await refresh()
    },
    async setCapacity(slotIdx, capacity) {
      await apiPost(`/api/pages/${pageId}/capacity`, { idx: slotIdx, capacity })
      await refresh()
    },
    async closeSlot(slotIdx) {
      await apiPost(`/api/pages/${pageId}/close`, { idx: slotIdx })
      await refresh()
    },
  }
}
