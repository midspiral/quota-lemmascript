// Picks the local-first implementations. The Cloudflare RemoteStore / RemoteAuth
// swap in here (gated on VITE_REMOTE) behind the same interfaces — no UI change.
import type { PageStore } from "./store"
import { createLocalStore } from "./store"
import type { Auth } from "./auth"
import { createLocalAuth } from "./auth"

export const REMOTE = import.meta.env.VITE_REMOTE === "1"

export function loadStore(pageId: string): PageStore {
  // if (REMOTE) return createRemoteStore(pageId)  // ← Cloudflare increment
  return createLocalStore(pageId)
}

// One account/auth instance for the whole app (LocalAuth today; RemoteAuth later).
export const auth: Auth = createLocalAuth()
