# Quota — App Design (local-first → Cloudflare)

How the Quota web app is built on top of the verified core (`src/domain.ts`). Companion to
`DESIGN.md` (the proofs) and `DESIGN.md §6` (the target architecture). This file is the
**shell**: the React UI, the swappable store, local operation, and the one-line path to a
Cloudflare backend.

> **Guiding rule (from the greenfield recipe):** the UI only ever (1) turns user actions into
> calls on a tiny **store** interface, and (2) renders what the **verified functions** return.
> No counting, capacity, or accept/reject logic lives in components — they call `domain.ts`.
> Build local-first; the same UI then talks to Cloudflare with no rewrite.

Stack: **Vite + React + TypeScript (strict)**, **Tailwind CSS** (elegant light theme),
hash-based routing. Everything is `.ts`/`.tsx`; the UI is typechecked against the core's
exported `Page`/`Slot`/`Booking` types.

---

## 1. The seams: one interface each, two implementations

The whole design hinges on a small interface the UI talks to. There is **one store per page**
(mirroring "one Durable Object per page" later). Booking is **fallible and async-shaped from
day one** — `book()` returns the *authoritative* outcome — so the pessimistic remote path is a
drop-in, not a rewrite.

```ts
// src/store.ts — the ONLY module that imports the mutating domain functions.
export interface PageStore {
  getSnapshot(): Page
  subscribe(fn: () => void): () => void
  // booking side (anonymous, contended, fallible)
  book(slotIdx: number, key: string): Promise<{ outcome: BookOutcome; bookingId: string }>
  cancel(bookingId: string): Promise<void>
  // provider side (management)
  addSlot(label: string, capacity: number): Promise<void>
  setCapacity(slotIdx: number, capacity: number): Promise<void>
  closeSlot(slotIdx: number): Promise<void>
}
```

- **`LocalStore`** (this increment): holds the `Page` in memory, persists to `localStorage`,
  notifies subscribers. `book()` mints a `bookingId`, calls the verified **`tryBook`**, saves,
  and resolves with the outcome (`confirmed | duplicate | full`). `cancel` → verified
  **`cancel`**; the provider methods → **`addSlot`/`setCapacity`/`closeSlot`** (clamping
  `setCapacity` to `≥ confirmedCount` so the verified precondition always holds). Synchronous
  underneath, Promise-shaped on the surface.
- **`RemoteStore`** (Cloudflare stage): same interface, speaks WebSocket to the page's Durable
  Object; `book()` awaits the DO's authoritative reply. **The UI does not change.**

`src/config.ts` picks the implementation from a build flag (`VITE_REMOTE`), exactly one branch
in a `loadStore(pageId)` factory.

## 2. Components

```
src/
  domain.ts          ← verified core (unchanged; imported by store + hook)
  store.ts           ← PageStore interface + LocalStore (only importer of mutations)
  catalog.ts         ← local page registry: username/pagename ⟷ pageId, "my pages" (localStorage)
  identity.ts        ← anonymous booker key + "my bookings" (bookingIds) (localStorage)
  useQuota.ts        ← hooks wrapping the verified QUERIES (no domain math in components)
  config.ts          ← LocalStore vs RemoteStore (VITE_REMOTE flag)
  router.tsx         ← tiny hash router (#/, #/new, #/:user/:page, #/:user/:page/manage)
  App.tsx            ← layout + routes
  main.tsx           ← entry
  components/
    BookingPage.tsx  ← PUBLIC airy single-column list (the centerpiece)
    SlotRow.tsx      ← one slot: label, capacity bar, “N left”, Book / booked / cancel
    Console.tsx      ← provider home: your handle, your pages, “New page”
    NewPage.tsx      ← create a page (title, username/pagename slug, initial slots)
    PageEditor.tsx   ← manage one page: add/close slots, set capacity, bookers, share link
    ui.tsx           ← small Tailwind atoms (Button, Card, Bar, Field)
  index.css          ← Tailwind directives + a few theme tokens
```

`useQuota.ts` is the *only* caller of the verified read functions, via
`useSyncExternalStore`:

```ts
export function usePage(store: PageStore) {
  const page = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return {
    page,
    available: availableSlots(page),       // verified per-slot room mask
    soldOut: soldOut(page),                // verified
    remainingOf: (i: number) => remaining(page, i),   // verified (page is well-formed, i in range)
    bookersOf:   (i: number) => bookersOf(page, i),   // verified: length === the count
    book: store.book, cancel: store.cancel,
  }
}
```

So a `SlotRow` renders `available[i]` / `remainingOf(i)` and never computes capacity itself —
the number on the cell is, by construction, the verified count.

## 3. The two surfaces

**Public booking page** — `#/:username/:pagename` (the chosen *airy single-column list*):

```
              Yoga with Sam
              ─────────────────────────

              Mon  9:00 AM        2 left
              ▓▓▓▓▓▓▓▓░░         [ Book ]

              Mon 10:00 AM         full
              ▓▓▓▓▓▓▓▓▓▓          booked   ← your booking shows “Cancel”

              Wed  6:00 PM        3 left
              ▓▓▓▓▓░░░░░         [ Book ]
```

- No login. Each row: label, a capacity bar (`confirmed / capacity`), “N left” or **full**, and
  an action. **Book** awaits `store.book(i, myKey)` and reflects the authoritative outcome
  inline: *pending…* → ✓ booked / “sold out — try another” / “already yours”. Multi-slot is
  allowed, so you can book several rows.
- A booker who holds a row sees **Cancel** (uses the stored `bookingId`). “Your bookings” are
  tracked per device in `localStorage`.
- A page-level banner when `soldOut(page)`.

**Provider console** — `#/` (your pages) and `#/:username/:pagename/manage`:

- `Console`: your local handle + a list of your pages with quick stats (slots, total booked),
  and **New page**.
- `NewPage`: title, a `username/pagename` slug (validated/normalized locally), and initial
  slots (label + capacity, default 1). Calls `catalog.createPage` → `initPage` + register.
- `PageEditor`: add a slot, **set capacity** (the input floors at the current booked count —
  the verified “can’t lower below booked” rule, surfaced as a disabled state), **close** a slot
  (caps it at its count), and per-slot **bookers** via verified `bookersOf` (the list length
  provably equals the badge). A **share link** to the public page, and a live preview.

## 4. Local operation (this increment)

- **State**: each page is a verified `Page` in `localStorage` under `quota:page:<id>`; the
  catalog (`username/pagename → id`, your page list) under `quota:catalog`; your booker key and
  bookings under `quota:me`.
- **Identity**: locally there is no auth and a single namespace — *you are both provider and
  booker*. A stored handle names your pages; an anonymous key identifies you as a booker (for
  dedup + “your bookings” + cancel). This is the honest single-device sandbox.
- **Why it already feels right**: because `book()` is fallible/async and the UI renders only
  verified outputs, the local app behaves exactly as the multi-device one will — minus real
  concurrency.

## 5. The Cloudflare swap (next increment, no UI rewrite)

What changes is confined to **infra modules**; `App`, `useQuota`, every component, and
`domain.ts` are untouched (DESIGN.md §6):

| Concern | Local (now) | Cloudflare (next) |
|---|---|---|
| Per-page state | `LocalStore` + `localStorage` | `RemoteStore` (WebSocket) → **Durable Object per page**, applies the same `tryBook`/`cancel`/`replay` server-authoritatively |
| `book()` outcome | computed locally | the **DO’s authoritative** accept/reject (pessimistic) — same return type |
| Catalog / vanity URL | `catalog.ts` over `localStorage` | **D1 registry** (`username` unique, `pagename` unique per provider) → opaque `pageId` → `idFromName(pageId)` |
| Provider auth | none (single-namespace sandbox) | **magic-link email**; gates only the management routes |
| Booker identity | `localStorage` key | same key, sent on connect |

The store seam is *why* this is a one-line swap, and the **`bookCountOrderInvariant`** /
`replayPreservesInv` proofs are *why* the lock-free, single-serializer DO is safe (availability
is order-free; only the DO’s total order decides the contended winner). Hosting itself (a
single Worker serving the SPA + `/api/*`) is the owner’s deploy step.

## 6. Aesthetic

Light, airy, editorial. Generous whitespace, a single warm accent, restrained type scale,
capacity bars as the one piece of “data viz.” Tailwind tokens kept minimal (a small theme in
`tailwind.config`); no component library. Mobile-first single column; the console/editor widen
to a calm two-column on desktop.

## 7. Out of scope (this increment)

Real auth, the D1 registry, WebSockets/Durable Objects, email, rate-limiting, tentative
holds/TTL, waitlist — all deferred to the Cloudflare stage or later (DESIGN.md §9/§11). This
increment is a complete, elegant, **single-device** app over the verified core.
