// The auth seam. A real magic link needs a server (to email the link and to
// mint/verify a signed token), so locally it's a faithful *simulation*:
// requestLink returns a dev link to show on-screen instead of emailing, and the
// token is a stand-in. RemoteAuth (Cloudflare) implements the same interface with
// a real email + signed-token verification — no UI change.
import { load, save, remove, uid } from "./persist"
import { claimHandle } from "./identity"

export interface Session {
  email: string
  name: string
  handle: string // public username used in vanity URLs (derived from email, locally)
}

export interface Auth {
  current(): Session | null
  subscribe(fn: () => void): () => void
  // devLink present ⇒ show it to click (local/keyless); absent ⇒ a real email was sent
  requestLink(email: string, name: string, returnTo: string): Promise<{ devLink?: string }>
  signInWithToken(token: string): Promise<Session>
  signOut(): void
}

const SESSION = "quota:session"
const PENDING = "quota:pending-auth"

interface Pending {
  email: string
  name: string
  token: string
}

export function createLocalAuth(): Auth {
  const subs = new Set<() => void>()
  const notify = (): void => subs.forEach((f) => f())
  // Cache the session reference so getSnapshot is stable across renders
  // (useSyncExternalStore loops if it returns a fresh object each call).
  let session: Session | null = load<Session | null>(SESSION, null)

  return {
    current: () => session,
    subscribe(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    async requestLink(email, name, returnTo) {
      const token = uid()
      save<Pending>(PENDING, { email, name, token })
      // In production this link is emailed; locally we surface it so you can click it.
      return { devLink: `#/auth?token=${token}&returnTo=${encodeURIComponent(returnTo)}` }
    },
    async signInWithToken(token) {
      const pending = load<Pending | null>(PENDING, null)
      if (pending !== null && pending.token === token) {
        session = { email: pending.email, name: pending.name, handle: claimHandle(pending.email) }
        save(SESSION, session)
        remove(PENDING)
        notify()
        return session
      }
      // Idempotent: a re-presented/consumed link is fine if we're already signed in
      // (e.g. React StrictMode double-invokes the sign-in effect in dev).
      if (session !== null) return session
      throw new Error("This sign-in link is invalid or has already been used.")
    },
    signOut() {
      session = null
      remove(SESSION)
      notify()
    },
  }
}
