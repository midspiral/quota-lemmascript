import { useState } from "react"
import type { FormEvent } from "react"
import type { Auth } from "../auth"
import { Button, Card, Field, Input } from "./ui"

// Account sign-in (providers and bookers alike). The server either emails a real
// magic link (Stytch) or — keyless/local — returns a dev link to click. After
// sign-in we return to `returnTo`.
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
  const [submitted, setSubmitted] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ready = email.includes("@") && name.trim() !== ""

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const res = await auth.requestLink(email.trim(), name.trim(), returnTo)
      setDevLink(res.devLink ?? null)
      setSubmitted(true)
    } catch {
      setError("Couldn't start sign-in. Please try again.")
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
      <p className="mt-2 text-center text-sm text-stone-500">{subtitle}</p>

      <Card className="mt-8 p-6">
        {!submitted ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
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
            {error !== null && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !ready}>
              {busy ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-stone-600">
              We sent a magic link to <span className="font-medium text-stone-800">{email}</span>.
            </p>
            {devLink !== null ? (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm">
                <p className="mb-3 text-amber-800">Local dev: no email is sent — click your link below.</p>
                <a
                  href={devLink}
                  className="inline-flex items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                >
                  📧 Open magic link
                </a>
              </div>
            ) : (
              <p className="text-xs text-stone-400">Check your inbox (and spam). The link expires shortly.</p>
            )}
            <button
              className="text-xs text-stone-400 underline hover:text-stone-600"
              onClick={() => {
                setSubmitted(false)
                setDevLink(null)
              }}
            >
              use different details
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
