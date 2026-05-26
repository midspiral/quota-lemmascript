// Picks local-first vs Cloudflare implementations for all three seams, gated on
// the VITE_REMOTE build flag. This is the ONLY place the choice is made; the UI
// never branches on it.
import type { PageStore } from "./store"
import { createLocalStore } from "./store"
import { createRemoteStore } from "./remoteStore"
import type { Auth } from "./auth"
import { createLocalAuth } from "./auth"
import { createRemoteAuth } from "./remoteAuth"
import type { Catalog } from "./catalog"
import { localCatalog } from "./catalog"
import { remoteCatalog } from "./remoteCatalog"

export const REMOTE = import.meta.env.VITE_REMOTE === "1"

export function loadStore(pageId: string): PageStore {
  return REMOTE ? createRemoteStore(pageId) : createLocalStore(pageId)
}

export const auth: Auth = REMOTE ? createRemoteAuth() : createLocalAuth()

export const catalog: Catalog = REMOTE ? remoteCatalog : localCatalog
