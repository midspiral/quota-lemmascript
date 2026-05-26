// The registry behind an async interface so local and remote share one UI.
// Local: localStorage maps. Remote: the D1-backed Worker (src/remoteCatalog.ts).
import type { Page, Slot } from "./domain"
import { initPage } from "./domain"
import { load, save, pageKey, uid } from "./persist"
import { nameFor } from "./identity"

export interface PageRef {
  username: string
  pagename: string
  pageId: string
  title: string
}

export interface BookerInfo {
  slotIdx: number
  name: string
  email: string
  bookingId: string
}

export interface Catalog {
  listPages(handle: string): Promise<PageRef[]>
  resolve(username: string, pagename: string): Promise<PageRef | null>
  // throws if the (handle, pagename) slug is already taken
  createPage(handle: string, pagename: string, title: string, slots: Slot[]): Promise<PageRef>
  bookers(pageId: string): Promise<BookerInfo[]>
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

const CATALOG = "quota:catalog"
const allRefs = (): PageRef[] => load<PageRef[]>(CATALOG, [])

export const localCatalog: Catalog = {
  async listPages(handle) {
    return allRefs().filter((r) => r.username === handle)
  },
  async resolve(username, pagename) {
    return allRefs().find((r) => r.username === username && r.pagename === pagename) ?? null
  },
  async createPage(handle, pagename, title, slots) {
    if (allRefs().some((r) => r.username === handle && r.pagename === pagename)) {
      throw new Error("you already have a page with that slug")
    }
    const pageId = uid()
    const page: Page = initPage(pageId, title, slots) // verified: well-formed
    save(pageKey(pageId), page)
    const ref: PageRef = { username: handle, pagename, pageId, title }
    save(CATALOG, [...allRefs(), ref])
    return ref
  },
  async bookers(pageId) {
    const page = load<Page | null>(pageKey(pageId), null)
    if (page === null) return []
    return page.bookings
      .filter((b) => b.status === "confirmed")
      .map((b) => ({ slotIdx: b.slotIdx, email: b.key, name: nameFor(b.key), bookingId: b.id }))
  },
}
