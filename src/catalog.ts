// The local page registry: maps a vanity (username/pagename) to an opaque pageId,
// and tracks a provider's pages. Cloudflare swaps this for a D1 registry (same
// shape) keyed the same way; the booking Durable Object is addressed by pageId.
import type { Page, Slot } from "./domain"
import { initPage } from "./domain"
import { load, save, pageKey, uid } from "./persist"

export interface PageRef {
  username: string
  pagename: string
  pageId: string
  title: string
}

const CATALOG = "quota:catalog"

export function allRefs(): PageRef[] {
  return load<PageRef[]>(CATALOG, [])
}

export function listPages(username: string): PageRef[] {
  return allRefs().filter((r) => r.username === username)
}

export function resolve(username: string, pagename: string): PageRef | null {
  return allRefs().find((r) => r.username === username && r.pagename === pagename) ?? null
}

export function pagenameTaken(username: string, pagename: string): boolean {
  return resolve(username, pagename) !== null
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

// Create a page the verified way (initPage establishes the invariant) and register it.
export function createPage(username: string, pagename: string, title: string, slots: Slot[]): PageRef {
  const pageId = uid()
  const page: Page = initPage(pageId, title, slots)
  save(pageKey(pageId), page)
  const ref: PageRef = { username, pagename, pageId, title }
  save(CATALOG, [...allRefs(), ref])
  return ref
}
