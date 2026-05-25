import { useState } from "react"
import type { FormEvent } from "react"
import type { Auth } from "../auth"
import { Button, Card, Field, Input } from "./ui"

// Account sign-in (providers and bookers alike). Locally the "magic link" is
// faked: requestLink returns a dev link we render to click. RemoteAuth emails a
// real signed token instead. After sign-in we return to `returnTo` (so a booker
// who signed in to grab a slot lands back on that page).
export function SignIn({
  auth,
  returnTo = "/",
  title = "Sign in to Quota",
  subtitle = "One account to create pages and to book slots.",
}: {
  auth: Auth
  returnTo?: string
  title?: string
  subtitle?: string
}) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [devLink, setDevLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ready = email.includes("@") && name.trim() !== ""

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    const res = await auth.requestLink(email.trim(), name.trim())
    setDevLink(`${res.devLink}&returnTo=${encodeURIComponent(returnTo)}`)
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
      <p className="mt-2 text-center text-sm text-stone-500">{subtitle}</p>

      <Card className="mt-8 p-6">
        {devLink === null ? (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Name">
              <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Email" hint="No password — we'll send you a magic link.">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" disabled={busy || !ready}>
              {busy ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-stone-600">
              We sent a magic link to <span className="font-medium text-stone-800">{email}</span>.
            </p>
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm">
              <p className="mb-3 text-amber-800">Local dev: no email is sent — click your link below.</p>
              <a
                href={devLink}
                className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
              >
                📧 Open magic link
              </a>
            </div>
            <button
              className="text-xs text-stone-400 underline hover:text-stone-600"
              onClick={() => setDevLink(null)}
            >
              use different details
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
