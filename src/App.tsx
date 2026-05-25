import { useEffect, useState } from "react"
import type { Auth } from "./auth"
import { createLocalAuth } from "./auth"
import { useRoute, navigate } from "./router"
import { useSession } from "./useQuota"
import { SignIn } from "./components/SignIn"
import { Console } from "./components/Console"
import { NewPage } from "./components/NewPage"
import { BookingPage } from "./components/BookingPage"
import { PageEditor } from "./components/PageEditor"
import { NotFound } from "./components/NotFound"
import { Button } from "./components/ui"

// One auth instance for the app (LocalAuth today; RemoteAuth at the Cloudflare stage).
const auth: Auth = createLocalAuth()

export default function App() {
  const route = useRoute()
  const session = useSession(auth)

  let screen
  switch (route.name) {
    case "home":
      screen = session !== null ? <Console session={session} /> : <SignIn auth={auth} />
      break
    case "new":
      screen = session !== null ? <NewPage session={session} /> : <SignIn auth={auth} />
      break
    case "auth":
      screen = <AuthCallback auth={auth} token={route.token} />
      break
    case "booking":
      screen = <BookingPage username={route.username} pagename={route.pagename} />
      break
    case "manage":
      screen =
        session !== null ? (
          <PageEditor username={route.username} pagename={route.pagename} session={session} />
        ) : (
          <SignIn auth={auth} />
        )
      break
    default:
      screen = <NotFound />
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <a href="#/" className="text-sm font-semibold tracking-tight text-stone-900">
            Quota
          </a>
          {session !== null && (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-stone-400">{session.handle}</span>
              <button
                className="text-stone-500 hover:text-stone-800"
                onClick={() => {
                  auth.signOut()
                  navigate("/")
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main>{screen}</main>
    </div>
  )
}

function AuthCallback({ auth, token }: { auth: Auth; token: string }) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    auth
      .signInWithToken(token)
      .then(() => {
        if (active) navigate("/")
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [token])

  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      {error === null ? (
        <p className="text-stone-500">Signing you in…</p>
      ) : (
        <>
          <p className="text-rose-600">{error}</p>
          <div className="mt-6">
            <Button variant="ghost" onClick={() => navigate("/")}>
              Back to sign in
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
