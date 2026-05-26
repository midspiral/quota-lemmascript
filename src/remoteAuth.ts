// RemoteAuth: the Auth seam over the Worker's /api/auth/*. The faked dev link is
// now a real (HMAC-signed) token the Worker mints; signing in stores a bearer
// session token. Same interface as LocalAuth, so the UI is unchanged.
import type { Auth, Session } from "./auth"
import { apiPost, setToken, clearToken } from "./api"
import { load, save, remove } from "./persist"

const SESSION = "quota:session"

export function createRemoteAuth(): Auth {
  const subs = new Set<() => void>()
  const notify = (): void => subs.forEach((f) => f())
  let session: Session | null = load<Session | null>(SESSION, null) // cached for a stable getSnapshot

  return {
    current: () => session,
    subscribe(fn) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
    async requestLink(email, returnTo) {
      const r = await apiPost<{ devLink?: string }>("/api/auth/request", { email, returnTo })
      if (r.status !== 200 || r.data === null) throw new Error("could not start sign-in")
      // devLink present in keyless/dev mode; absent when a real email was sent (Stytch)
      return { devLink: r.data.devLink }
    },
    async signInWithToken(token) {
      const r = await apiPost<{ session: Session; token: string }>("/api/auth/verify", { token })
      if (r.status !== 200 || r.data === null) throw new Error("Sign-in failed. Please try again.")
      setToken(r.data.token)
      session = r.data.session
      save(SESSION, session)
      notify()
      return session
    },
    signOut() {
      session = null
      clearToken()
      remove(SESSION)
      notify()
    },
  }
}
