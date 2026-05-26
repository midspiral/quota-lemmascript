import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import type { Session } from "../auth"
import { useProfile } from "../useQuota"
import { Button, Card, Field, Input } from "./ui"

// Account settings: set an optional display name (shown to providers you book
// with). Email is the identity and is read-only.
export function Account({ session }: { session: Session }) {
  const { name, loading, save } = useProfile()
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => setValue(name), [name])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setSaved(false)
    await save(value)
    setBusy(false)
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Account</h1>
      <Card className="mt-8 space-y-4 p-6">
        <Field label="Email">
          <Input value={session.email} disabled />
        </Field>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <Field label="Display name" hint="Optional — shown to providers you book with; defaults to your email.">
            <Input
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setSaved(false)
              }}
              placeholder="Your name"
              disabled={loading}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy || loading}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {saved && <span className="text-sm text-stone-500">Saved.</span>}
          </div>
        </form>
      </Card>
    </div>
  )
}
