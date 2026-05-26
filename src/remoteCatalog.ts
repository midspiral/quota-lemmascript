// RemoteCatalog: the registry over the D1-backed Worker. Same interface as
// localCatalog (handle/slug uniqueness is enforced server-side by D1).
import type { Catalog, PageRef, BookerInfo } from "./catalog"
import { apiGet, apiPost, getToken } from "./api"

export const remoteCatalog: Catalog = {
  async listPages() {
    // server scopes to the authenticated account (token); handle arg is ignored
    const r = await apiGet<{ pages: PageRef[] }>("/api/me/pages")
    return r.data?.pages ?? []
  },
  async resolve(username, pagename) {
    const r = await apiGet<{ pageId: string; title: string }>(
      `/api/u/${encodeURIComponent(username)}/${encodeURIComponent(pagename)}`,
    )
    if (r.status !== 200 || r.data === null) return null
    return { username, pagename, pageId: r.data.pageId, title: r.data.title }
  },
  async createPage(_handle, pagename, title, slots) {
    const r = await apiPost<{ username: string; pagename: string; pageId: string }>("/api/pages", {
      pagename,
      title,
      slots,
    })
    if (r.status === 409) throw new Error("you already have a page with that slug")
    if (r.status !== 200 || r.data === null) throw new Error("could not create page")
    return { username: r.data.username, pagename: r.data.pagename, pageId: r.data.pageId, title }
  },
  async bookers(pageId) {
    const r = await apiGet<{ bookers: BookerInfo[] }>(`/api/pages/${pageId}/bookers`)
    return r.data?.bookers ?? []
  },
  async exportNdjson(pageId) {
    const token = getToken()
    const r = await fetch(`/api/pages/${pageId}/export.ndjson`, {
      headers: token === null ? {} : { authorization: `Bearer ${token}` },
    })
    return r.ok ? await r.text() : ""
  },
}
