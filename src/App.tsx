import { useEffect, useState } from "react"
import { auth } from "./config"
import { rememberPerson } from "./identity"
import { useRoute, navigate, manageHref } from "./router"
import { useSession } from "./useQuota"
import { SignIn } from "./components/SignIn"
import { Console } from "./components/Console"
import { NewPage } from "./components/NewPage"
import { BookingPage } from "./components/BookingPage"
import { PageEditor } from "./components/PageEditor"
import { NotFound } from "./components/NotFound"
import { Button } from "./components/ui"

export default function App() {
  const route = useRoute()
  const session = useSession(auth)

  // Stytch redirects to the root with ?token=…&stytch_token_type=… (a real query,
  // not our hash route). Complete sign-in here, then bounce to the hash app.
  const search = new URLSearchParams(location.search)
  const stytchToken = search.get("token")

  let screen
  if (stytchToken !== null && search.get("stytch_token_type") !== null) {
    const returnTo = localStorage.getItem("quota:returnTo") ?? "/"
    screen = <StytchCallback token={stytchToken} returnTo={returnTo} />
  } else
  switch (route.name) {
    case "home":
      screen = session !== null ? <Console session={session} /> : <SignIn auth={auth} returnTo="/" />
      break
    case "new":
      screen = session !== null ? <NewPage session={session} /> : <SignIn auth={auth} returnTo="/new" />
      break
    case "auth":
      screen = <AuthCallback token={route.token} returnTo={route.returnTo} />
      break
    case "booking":
      screen = <BookingPage username={route.username} pagename={route.pagename} />
      break
    case "manage":
      screen =
        session !== null ? (
          <PageEditor username={route.username} pagename={route.pagename} session={session} />
        ) : (
          <SignIn auth={auth} returnTo={manageHref(route.username, route.pagename).slice(1)} />
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
              <span className="text-stone-500">{session.name}</span>
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

// Stytch callback: token arrives in the query at the root path. Verify, then
// replace the URL with the clean hash route (drops the query, picks up the
// now-stored session on reload).
function StytchCallback({ token, returnTo }: { token: string; returnTo: string }) {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    auth
      .signInWithToken(token)
      .then((s) => {
        rememberPerson(s.email, s.name)
        window.location.replace(`/#${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`)
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
            <Button variant="ghost" onClick={() => window.location.replace("/")}>
              Back to sign in
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function AuthCallback({ token, returnTo }: { token: string; returnTo: string }) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    auth
      .signInWithToken(token)
      .then((session) => {
        rememberPerson(session.email, session.name)
        if (active) navigate(returnTo)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      active = false
    }
  }, [token, returnTo])

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
