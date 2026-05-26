// The auth seam. Sign-in is email-only (magic link); the email is the identity.
// LocalAuth fakes the link locally; RemoteAuth (src/remoteAuth.ts) talks to the
// Worker (custom HMAC or Stytch). Auth is a trusted edge, outside the verified core.
import { load, save, remove, uid } from "./persist"
import { claimHandle } from "./identity"

export interface Session {
  email: string
  handle: string // public username for vanity URLs (claimed from the email)
}

export interface Auth {
  current(): Session | null
  subscribe(fn: () => void): () => void
  // devLink present ⇒ show it to click (local/keyless); absent ⇒ a real email was sent
  requestLink(email: string, returnTo: string): Promise<{ devLink?: string }>
  signInWithToken(token: string): Promise<Session>
  signOut(): void
}

const SESSION = "quota:session"
const PENDING = "quota:pending-auth"

interface Pending {
  email: string
  token: string
}

export function createLocalAuth(): Auth {
  const subs = new Set<() => void>()
  const notify = (): void => subs.forEach((f) => f())
  // Cache the session reference so getSnapshot is stable across renders.
  let session: Session | null = load<Session | null>(SESSION, null)

  return {
    current: () => session,
    subscribe(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    async requestLink(email, returnTo) {
      const token = uid()
      save<Pending>(PENDING, { email, token })
      // In production this link is emailed; locally we surface it so you can click it.
      return { devLink: `#/auth?token=${token}&returnTo=${encodeURIComponent(returnTo)}` }
    },
    async signInWithToken(token) {
      const pending = load<Pending | null>(PENDING, null)
      if (pending !== null && pending.token === token) {
        session = { email: pending.email, handle: claimHandle(pending.email) }
        save(SESSION, session)
        remove(PENDING)
        notify()
        return session
      }
      // Idempotent: a re-presented link is fine if we're already signed in
      // (React StrictMode double-invokes the sign-in effect in dev).
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
