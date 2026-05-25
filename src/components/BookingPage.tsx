import { useMemo, useState } from "react"
import { resolve } from "../catalog"
import { loadStore } from "../config"
import { usePage } from "../useQuota"
import { myKey, myBookings, rememberBooking, forgetBooking } from "../identity"
import { SlotRow } from "./SlotRow"
import { NotFound } from "./NotFound"
import { Card } from "./ui"

// Public, no-login booking page. Resolves the vanity URL to a pageId, then books
// pessimistically: each Book awaits the store's authoritative outcome.
export function BookingPage({ username, pagename }: { username: string; pagename: string }) {
  const ref = useMemo(() => resolve(username, pagename), [username, pagename])
  if (ref === null) return <NotFound message={`No page at ${username}/${pagename}.`} />
  return <BookingInner pageId={ref.pageId} />
}

function BookingInner({ pageId }: { pageId: string }) {
  const store = useMemo(() => loadStore(pageId), [pageId])
  const q = usePage(store)
  const key = myKey()
  const [busy, setBusy] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  const mineIds = new Set(myBookings(pageId))
  const myBookingAt = (i: number) =>
    q.page.bookings.find((b) => mineIds.has(b.id) && b.slotIdx === i && b.status === "confirmed")

  async function book(i: number): Promise<void> {
    setBusy(i)
    setNotes((n) => ({ ...n, [i]: "" }))
    const { outcome, bookingId } = await q.book(i, key)
    if (outcome === "confirmed") rememberBooking(pageId, bookingId)
    else if (outcome === "full") setNotes((n) => ({ ...n, [i]: "Sorry — that just filled up." }))
    else setNotes((n) => ({ ...n, [i]: "You already have this slot." }))
    setBusy(null)
  }

  async function cancel(i: number, bookingId: string): Promise<void> {
    setBusy(i)
    await q.cancel(bookingId)
    forgetBooking(pageId, bookingId)
    setBusy(null)
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{q.page.title}</h1>
        {q.isSoldOut && <p className="mt-2 text-sm text-stone-500">Every slot is full right now.</p>}
      </header>

      {q.page.slots.length === 0 ? (
        <p className="mt-10 text-center text-sm text-stone-400">No slots have been added yet.</p>
      ) : (
        <Card className="mt-8 px-6">
          <div className="divide-y divide-stone-200">
            {q.page.slots.map((slot, i) => {
              const mineB = myBookingAt(i)
              return (
                <SlotRow
                  key={i}
                  label={slot.label}
                  taken={q.confirmedOf(i)}
                  capacity={q.capacityOf(i)}
                  remaining={q.remainingOf(i)}
                  mine={mineB !== undefined}
                  busy={busy === i}
                  note={notes[i] !== undefined && notes[i] !== "" ? notes[i] : undefined}
                  onBook={() => void book(i)}
                  onCancel={() => {
                    if (mineB !== undefined) void cancel(i, mineB.id)
                  }}
                />
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
