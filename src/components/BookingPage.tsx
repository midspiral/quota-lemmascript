import { useMemo, useState } from "react"
import { loadStore, auth } from "../config"
import { usePage, useSession, usePageRef } from "../useQuota"
import { SlotRow } from "./SlotRow"
import { SignIn } from "./SignIn"
import { NotFound } from "./NotFound"
import { Card } from "./ui"

// Public booking page. Availability is viewable by anyone; booking requires an
// account (one-click once signed in). Signing in returns here (returnTo).
export function BookingPage({ username, pagename }: { username: string; pagename: string }) {
  const { loading, ref } = usePageRef(username, pagename)
  if (loading) return <Loading />
  if (ref === null) return <NotFound message={`No page at ${username}/${pagename}.`} />
  return <BookingInner pageId={ref.pageId} username={username} pagename={pagename} />
}

function Loading() {
  return <p className="mx-auto max-w-xl px-5 py-24 text-center text-sm text-stone-400">Loading…</p>
}

function BookingInner({ pageId, username, pagename }: { pageId: string; username: string; pagename: string }) {
  const store = useMemo(() => loadStore(pageId), [pageId])
  const q = usePage(store)
  const session = useSession(auth)
  const [busy, setBusy] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  if (q.page === null) return <Loading />
  const page = q.page

  const myEmail = session?.email ?? null
  const myBookingAt = (i: number) =>
    myEmail === null
      ? undefined
      : page.bookings.find((b) => b.key === myEmail && b.slotIdx === i && b.status === "confirmed")

  async function book(i: number): Promise<void> {
    if (session === null) return
    setBusy(i)
    setNotes((n) => ({ ...n, [i]: "" }))
    const { outcome } = await q.book(i, session.email)
    if (outcome === "full") setNotes((n) => ({ ...n, [i]: "Sorry — that just filled up." }))
    else if (outcome === "duplicate") setNotes((n) => ({ ...n, [i]: "You already have this slot." }))
    setBusy(null)
  }

  async function cancel(i: number, bookingId: string): Promise<void> {
    setBusy(i)
    await q.cancel(bookingId)
    setBusy(null)
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{page.title}</h1>
        {q.isSoldOut && <p className="mt-2 text-sm text-stone-500">Every slot is full right now.</p>}
      </header>

      {page.slots.length === 0 ? (
        <p className="mt-10 text-center text-sm text-stone-400">No slots have been added yet.</p>
      ) : (
        <Card className="mt-8 px-6">
          <div className="divide-y divide-stone-200">
            {page.slots.map((slot, i) => {
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
                  interactive={session !== null}
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

      {session === null && page.slots.length > 0 && (
        <SignIn
          auth={auth}
          returnTo={`/${username}/${pagename}`}
          title="Sign in to book"
          subtitle="Booking takes one click once you're signed in."
        />
      )}
    </div>
  )
}
