import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import type { Session } from "../auth"
import { loadStore } from "../config"
import { usePage, usePageRef, useBookers } from "../useQuota"
import { NotFound } from "./NotFound"
import { Bar, Button, Card, Input } from "./ui"
import { bookingHref, navigate } from "../router"

export function PageEditor({
  username,
  pagename,
  session,
}: {
  username: string
  pagename: string
  session: Session
}) {
  const { loading, ref } = usePageRef(username, pagename)
  if (loading) return <p className="mx-auto max-w-2xl px-5 py-24 text-center text-sm text-stone-400">Loading…</p>
  if (ref === null) return <NotFound message={`No page at ${username}/${pagename}.`} />
  if (session.handle !== username) return <NotFound message="This isn't your page to manage." />
  return <EditorInner pageId={ref.pageId} username={username} pagename={pagename} />
}

function EditorInner({ pageId, username, pagename }: { pageId: string; username: string; pagename: string }) {
  const store = useMemo(() => loadStore(pageId), [pageId])
  const q = usePage(store)
  const bookers = useBookers(pageId, q.page)
  const [label, setLabel] = useState("")
  const [cap, setCap] = useState("1")
  const [copied, setCopied] = useState(false)

  const shareUrl = `${location.origin}${location.pathname}${bookingHref(username, pagename)}`

  function addSlot(e: FormEvent): void {
    e.preventDefault()
    if (label.trim() === "") return
    void q.addSlot(label.trim(), Math.max(0, parseInt(cap, 10) || 0))
    setLabel("")
    setCap("1")
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  if (q.page === null) {
    return <p className="mx-auto max-w-2xl px-5 py-24 text-center text-sm text-stone-400">Loading…</p>
  }
  const page = q.page

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{page.title}</h1>
          <button
            onClick={() => void copyLink()}
            className="mt-1 font-mono text-xs text-stone-400 hover:text-stone-600"
            title="Copy public link"
          >
            {copied ? "copied!" : `${username}/${pagename} · copy link`}
          </button>
        </div>
        <Button variant="ghost" onClick={() => navigate(bookingHref(username, pagename))}>
          View public page
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {page.slots.map((slot, i) => {
          const confirmed = q.confirmedOf(i)
          const capacity = q.capacityOf(i)
          const atFloor = capacity <= confirmed
          const slotBookers = bookers.filter((b) => b.slotIdx === i)
          return (
            <Card key={i} className="p-5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-lg text-stone-800">{slot.label}</span>
                <span className="shrink-0 text-sm text-stone-500">
                  {confirmed} of {capacity} booked
                </span>
              </div>

              <div className="mt-3">
                <Bar taken={confirmed} capacity={capacity} />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-stone-400">capacity</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void q.setCapacity(i, capacity - 1)}
                      disabled={atFloor}
                      className="h-7 w-7 rounded-full border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                      title={atFloor ? "Can't drop below what's booked" : "Decrease"}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums text-stone-700">{capacity}</span>
                    <button
                      onClick={() => void q.setCapacity(i, capacity + 1)}
                      className="h-7 w-7 rounded-full border border-stone-300 text-stone-600 hover:bg-stone-100"
                      title="Increase"
                    >
                      +
                    </button>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => void q.closeSlot(i)} disabled={atFloor}>
                  Close
                </Button>
              </div>

              {slotBookers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
                  {slotBookers.map((b) => (
                    <span
                      key={b.bookingId}
                      className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                      title={b.email}
                    >
                      {b.name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
        {page.slots.length === 0 && (
          <p className="py-6 text-center text-sm text-stone-400">No slots yet — add one below.</p>
        )}
      </div>

      <Card className="mt-6 p-5">
        <form onSubmit={addSlot} className="flex items-end gap-2">
          <div className="flex-1">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New slot — e.g. Fri 8:00 PM" />
          </div>
          <div className="w-20 shrink-0">
            <Input
              type="number"
              min={0}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              aria-label="capacity"
            />
          </div>
          <Button type="submit" className="shrink-0">
            Add slot
          </Button>
        </form>
      </Card>
    </div>
  )
}
