# Quota

A booking app where **providers** publish a special page of a limited number of **featured
slots** and signed-in users grab them — with a **formally verified** core (no overbooking,
honest accept/reject) in [LemmaScript](https://github.com/midspiral/LemmaScript), and an
elegant React UI that runs **local-first** or on **Cloudflare**.

It's a deliberate sibling to [Quorum](https://github.com/midspiral/quorum-lemmascript):
Quorum is a count reaching *up to* a threshold; Quota is a count held *under* a limit — and,
because bookings *contend* for shared inventory, the opposite concurrency story.

## Layout

| | |
|---|---|
| `src/domain.ts` | **The verified core** (LemmaScript → Dafny). Never oversells; order-invariant counts. |
| `src/*.ts(x)` | React SPA + the swappable seams (`store`, `auth`, `catalog`). |
| `worker/` | Cloudflare Worker + `QuotaPage` Durable Object + D1 schema. |
| `DESIGN.md` | The verified core: data model, the proven properties, the staged proofs. |
| `DESIGN_APP.md` | The app: components, the store/auth seams, local operation. |
| `DESIGN_CLOUDFLARE.md` | The backend: Worker + DO + D1, and why the proofs license it. |

## Prerequisites

- **Node ≥ 22** (the test scripts import `.ts` directly via Node's type stripping).
- For the **Cloudflare** backend: nothing extra — `wrangler` is a dev dependency and runs the
  Worker + Durable Object + D1 locally via miniflare.
- For **`npm run verify`** (re-checking the proofs): [Dafny](https://github.com/dafny-lang/dafny)
  ≥ 4.x and the [LemmaScript](https://github.com/midspiral/LemmaScript) toolchain checked out at
  `../LemmaScript`.
- For **`npm run test:browser`**: Google Chrome installed (`playwright-core` drives it).

```sh
npm install
```

## Run it — local-first (no backend)

The fastest path. Everything lives in `localStorage`; the "magic link" is faked (shown
on-screen). Single device, no server.

```sh
npm run dev          # → http://localhost:5173
```

Sign in (**email only** → click the on-screen dev link) → optionally set a display name on the
**Account** page → **New page** → add slots → share the public link → book a slot. The display
name is an optional profile setting (providers see it, or your email if unset). See `DESIGN_APP.md`.

## Run it — on Cloudflare (real multi-device)

Runs the **same** verified `domain.ts` in a Durable Object, with a D1 registry and the Worker
serving the SPA. Booking is server-authoritative (never oversells under contention).

```sh
npm run db:init      # create the local D1 tables (once)
npm run worker:dev   # builds the SPA with VITE_REMOTE=1, then `wrangler dev` → http://localhost:8787
```

Open two browser windows on `http://localhost:8787` to watch one window's booking fill the
other's availability live. The magic link is real-ish (HMAC-signed token); locally no email is
sent, so the link is returned to the sign-in screen to click. Auth + the registry are the
**trusted edge** (outside the verified core).

## Verify & test

```sh
npm run verify        # re-check the Dafny proofs (needs Dafny + ../LemmaScript)
npm test              # domain smoke: exercises the verified core directly (Node)
npm run typecheck     # tsc over the app + the worker

# Backend smoke (start the server first):
npm run worker:dev &  ;  API=http://localhost:8787 npm run test:api

# Browser smoke — full flow in Chrome; works against EITHER server:
npm run dev &         ;  BASE=http://localhost:5173/ npm run test:browser
npm run worker:dev &  ;  BASE=http://localhost:8787/ npm run test:browser
```

`npm test` is dependency-light (just the verified core); `test:api` and `test:browser` need a
running server (and Chrome for the latter).

## Deploy to production (Cloudflare)

1. **Create the D1 database** and put its id in `wrangler.toml`:
   ```sh
   wrangler d1 create quota          # copy the database_id into [[d1_databases]]
   wrangler d1 execute quota --remote --file=worker/schema.sql
   ```
2. **Set the auth secret** (used to sign tokens — never commit it):
   ```sh
   wrangler secret put AUTH_SECRET
   ```
3. **Enable real magic links via Stytch** (a hosted auth provider — it handles email delivery,
   one-time-use, expiry, and rate limiting). Create a Stytch project, allow your redirect URL
   (`https://<your-app>/#/auth`) in its dashboard, and set the Worker secrets:
   ```sh
   wrangler secret put STYTCH_PROJECT_ID
   wrangler secret put STYTCH_SECRET
   # optional: STYTCH_API_URL=https://api.stytch.com/v1 for the live env (default is test)
   ```
   In the Stytch dashboard, add your origin to **Redirect URLs** (Login + Signup) — exactly the
   URL the Worker sends, e.g. `http://localhost:8787/` for local and `https://<your-domain>/` for
   prod (Stytch appends its own `?token=…`; the SPA completes sign-in from that, recovering
   `returnTo` from `localStorage`). **Heads-up:** on a new Stytch project, email magic links only
   send **to your own account address (or same-domain coworkers)** until you add billing — so
   test with the email you signed up to Stytch with.

   With the `STYTCH_*` secrets **unset**, the Worker uses its built-in **keyless HMAC** link and
   returns it in the response (dev behavior) — so `npm run dev` / `worker:dev` need no account,
   and the automated `test:api` / `test:browser` (which use the dev link) run green. The client
   is unchanged either way (auth lives behind the `Auth` seam). See `DESIGN_CLOUDFLARE.md §4`.
4. **Deploy:**
   ```sh
   npm run deploy     # VITE_REMOTE=1 vite build && wrangler deploy
   ```

The Worker serves the built SPA (`dist/`) and `/api/*`; one Durable Object is created per page
on demand. See `DESIGN_CLOUDFLARE.md` for the architecture and the open items (tentative
holds/TTL, rate-limiting, swapping in a hosted auth provider).

## What's verified vs. trusted

**Verified** (`domain.ts`, 71 Dafny VCs, 0 errors): the booking decision and the count behind
it — never oversold, accept-iff-room, conservation, cancellation frees seats, replay
determinism, and order-invariance of availability under contention. **Trusted** (stated
honestly): auth, the React UI, WebSocket/DO/D1 I/O, email, slot date/time labeling, and
abuse/rate-limiting. The same `domain.ts` runs in the browser and in the Durable Object — one
core, no drift.
