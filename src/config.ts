// Picks the store implementation. Local-first today; the Cloudflare RemoteStore
// swaps in here (gated on VITE_REMOTE) behind the same PageStore interface.
import type { PageStore } from "./store"
import { createLocalStore } from "./store"

export const REMOTE = import.meta.env.VITE_REMOTE === "1"

export function loadStore(pageId: string): PageStore {
  // if (REMOTE) return createRemoteStore(pageId)  // ← Cloudflare increment
  return createLocalStore(pageId)
}
