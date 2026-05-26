// Shared NDJSON export format (client + worker). Uses the verified `confirmedOnly`
// so the export provably carries exactly the bookings that determine availability
// (Stage 3b) — a query re-run over these lines yields the same answer.
import type { Page } from "./domain"
import { confirmedOnly } from "./domain"

export function toNdjson(p: Page, username: string, pagename: string, nameOf: (email: string) => string): string {
  const header = {
    type: "page",
    username,
    pagename,
    title: p.title,
    slots: p.slots.map((s) => ({ label: s.label, capacity: s.capacity })),
    exportedAt: new Date().toISOString(),
  }
  const lines = confirmedOnly(p.bookings).map((b) =>
    JSON.stringify({
      type: "booking",
      slotIdx: b.slotIdx,
      slot: p.slots[b.slotIdx]?.label ?? "",
      name: nameOf(b.key),
      email: b.key,
      bookingId: b.id,
      seq: b.seq,
    }),
  )
  return [JSON.stringify(header), ...lines].join("\n") + "\n"
}
