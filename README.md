# Quota

[![LemmaScript: verified](https://img.shields.io/badge/LemmaScript-verified-brightgreen)](https://github.com/midspiral/quota-lemmascript/actions/workflows/lemmascript.yml)


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
name is an optional profile setting (providers see it, or your email if unset). Providers can
**Export** a page's bookings as NDJSON from the editor (built on the verified `confirmedOnly`).
See `DESIGN_APP.md`.

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

See **[`DEPLOY.md`](DEPLOY.md)** for the full copy-pasteable runbook — `wrangler login`, create +
migrate the remote D1, set secrets (`AUTH_SECRET`, Stytch keys), `npm run deploy`, allowlist the
deployed origin in Stytch, and a live smoke test. In short:

```sh
npx wrangler login
npx wrangler d1 create quota                                   # paste the id into wrangler.toml
npx wrangler d1 execute quota --remote --file=worker/schema.sql
npx wrangler secret put AUTH_SECRET                            # + STYTCH_PROJECT_ID / STYTCH_SECRET
npm run deploy
```

With the `STYTCH_*` secrets **unset**, the Worker uses its built-in **keyless HMAC** link
(dev behavior) — so `npm run dev` / `worker:dev` need no account, and the automated
`test:api` / `test:browser` run green. The client is unchanged either way (auth lives behind the
`Auth` seam). The Worker serves the built SPA (`dist/`) + `/api/*`; one Durable Object is created
per page on demand.

## What's verified vs. trusted

**Verified** (`domain.ts`, 80 Dafny VCs, 0 errors): the booking decision and the count behind
it — never oversold, accept-iff-room, conservation, cancellation frees seats, replay
determinism, and order-invariance of availability under contention — now in full generality:
`confirmedCountPerm` / `hasRoomPermInvariant` prove availability depends only on the *multiset*
of the booking log (any reordering, not just the pairwise swap), via the `perm(...)` predicate
added to LemmaScript. **Trusted** (stated
honestly): auth, the React UI, WebSocket/DO/D1 I/O, email, slot date/time labeling, and
abuse/rate-limiting. The same `domain.ts` runs in the browser and in the Durable Object — one
core, no drift.
