import { Bar, Button } from "./ui"

// One slot in the public booking list (the airy single-column centerpiece).
// When not signed in (`interactive` false) it shows availability read-only.
export function SlotRow(props: {
  label: string
  taken: number
  capacity: number
  remaining: number
  mine: boolean
  busy: boolean
  interactive: boolean
  note?: string
  onBook: () => void
  onCancel: () => void
}) {
  const { label, taken, capacity, remaining, mine, busy, interactive, note, onBook, onCancel } = props
  const full = remaining <= 0

  return (
    <div className="py-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-lg text-stone-800">{label}</span>
        <span className={`shrink-0 text-sm ${full ? "text-stone-400" : "text-stone-500"}`}>
          {full ? "full" : `${remaining} left`}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Bar taken={taken} capacity={capacity} />
        <div className="shrink-0">
          {!interactive ? (
            full ? (
              <span className="text-sm text-stone-400">full</span>
            ) : (
              <span className="text-sm text-stone-400">available</span>
            )
          ) : mine ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-amber-700">✓ You're in</span>
              <Button variant="danger" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
            </div>
          ) : full ? (
            <span className="text-sm text-stone-400">booked</span>
          ) : (
            <Button onClick={onBook} disabled={busy}>
              {busy ? "…" : "Book"}
            </Button>
          )}
        </div>
      </div>

      {note !== undefined && <p className="mt-2 text-sm text-stone-500">{note}</p>}
    </div>
  )
}
