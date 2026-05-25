import { useState } from "react"
import type { FormEvent } from "react"
import type { Session } from "../auth"
import type { Slot } from "../domain"
import { createPage, pagenameTaken, slugify } from "../catalog"
import { navigate, manageHref } from "../router"
import { Button, Card, Field, Input } from "./ui"

interface DraftSlot {
  label: string
  capacity: string // kept as string for the input; parsed on submit
}

// Create a page: title, a vanity slug, and an initial set of slots (capacity
// defaults to 1 — a single appointment; a class with N seats is N slots).
export function NewPage({ session }: { session: Session }) {
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [slots, setSlots] = useState<DraftSlot[]>([{ label: "", capacity: "1" }])
  const [error, setError] = useState<string | null>(null)

  const effectiveSlug = slug !== "" ? slug : slugify(title)

  function onTitle(v: string): void {
    setTitle(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  function setSlot(i: number, patch: Partial<DraftSlot>): void {
    setSlots((s) => s.map((sl, j) => (j === i ? { ...sl, ...patch } : sl)))
  }
  function addSlot(): void {
    setSlots((s) => [...s, { label: "", capacity: "1" }])
  }
  function removeSlot(i: number): void {
    setSlots((s) => s.filter((_, j) => j !== i))
  }

  function submit(e: FormEvent): void {
    e.preventDefault()
    const name = slugify(effectiveSlug)
    if (title.trim() === "") return setError("Give your page a title.")
    if (name === "") return setError("Choose a URL slug.")
    if (pagenameTaken(session.handle, name)) return setError("You already have a page with that slug.")
    const built: Slot[] = slots
      .filter((s) => s.label.trim() !== "")
      .map((s) => ({ label: s.label.trim(), capacity: Math.max(0, parseInt(s.capacity, 10) || 0) }))
    if (built.length === 0) return setError("Add at least one slot with a label.")
    createPage(session.handle, name, title.trim(), built)
    navigate(manageHref(session.handle, name))
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">New page</h1>

      <Card className="mt-8 space-y-5 p-6">
        <form onSubmit={submit} className="space-y-5">
          <Field label="Title">
            <Input value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Yoga with Sam" autoFocus />
          </Field>

          <Field label="Public URL" hint={`quota.app/${session.handle}/${slugify(effectiveSlug) || "…"}`}>
            <Input
              value={effectiveSlug}
              onChange={(e) => {
                setSlugEdited(true)
                setSlug(e.target.value)
              }}
              placeholder="yoga"
            />
          </Field>

          <div className="space-y-2">
            <span className="text-sm font-medium text-stone-700">Slots</span>
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={s.label}
                    onChange={(e) => setSlot(i, { label: e.target.value })}
                    placeholder={`Slot ${i + 1} — e.g. Mon 9:00 AM`}
                  />
                </div>
                <div className="w-20 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    value={s.capacity}
                    onChange={(e) => setSlot(i, { capacity: e.target.value })}
                    aria-label="capacity"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="px-2 text-stone-400 hover:text-rose-500"
                  aria-label="remove slot"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={addSlot} className="text-sm text-amber-700 hover:underline">
              + Add slot
            </button>
            <p className="text-xs text-stone-400">Capacity is seats per slot (1 = a single appointment).</p>
          </div>

          {error !== null && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => navigate("/")}>
              Cancel
            </Button>
            <Button type="submit">Create page</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
