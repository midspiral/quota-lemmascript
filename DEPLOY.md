# Quota — Production deploy (Cloudflare)

A copy-pasteable runbook for shipping Quota to your own Cloudflare account: one Worker serving
the SPA + `/api/*`, one Durable Object per page, and a D1 registry. Auth is Stytch (real magic
links). These are **your** commands — they run against your Cloudflare account, so run them in
your terminal (use `!` in this session for the interactive `wrangler login` if you like).

> Pre-flight already done: `npx wrangler deploy --dry-run` validates the Worker bundle + bindings
> (DO, D1, Assets) with no upload. It passes. `npm run typecheck` is clean. So the steps below are
> account setup + the real upload.

## 0. Prerequisites

- A Cloudflare account.
- **Durable Objects**: this Worker uses **SQLite-backed** DOs (`new_sqlite_classes`), which are
  available on the **free** Workers plan. If a step errors that DOs need a paid plan, enable
  **Workers Paid** ($5/mo).
- A **Stytch** project with **billing added** (done ✓ — so it can email arbitrary recipients).
  For production, use the **Live** environment's keys (see step 4); the Test env also works.
- `npm install` has been run in this repo.

## 1. Log in to Cloudflare

```sh
npx wrangler login        # opens a browser; authorizes wrangler for your account
npx wrangler whoami       # confirm you're logged in
```

## 2. Create the D1 database and wire its id

```sh
npx wrangler d1 create quota
```

Copy the printed `database_id` into **`wrangler.toml`**, replacing the placeholder:

```toml
[[d1_databases]]
binding = "DB"
database_name = "quota"
database_id = "PASTE-THE-REAL-ID-HERE"   # was "local-dev-placeholder"
```

## 3. Create the registry tables on the remote D1

```sh
npx wrangler d1 execute quota --remote --file=worker/schema.sql
```

(`--remote` targets the real D1, not the local dev copy.)

## 4. Set the Worker secrets

These go to the **deployed** Worker (stored by Cloudflare) — separate from `.dev.vars`, which is
local-only. You'll be prompted to paste each value.

```sh
# A strong random session-signing key (NOT the dev one). Generate one:
openssl rand -base64 32
npx wrangler secret put AUTH_SECRET          # paste the generated value

# Stytch — use your LIVE project keys for production (Dashboard → toggle to "Live" → API Keys):
npx wrangler secret put STYTCH_PROJECT_ID    # project-live-…
npx wrangler secret put STYTCH_SECRET        # secret-live-…
npx wrangler secret put STYTCH_API_URL       # https://api.stytch.com/v1   (live endpoint)
```

> Using the **Test** env instead is fine for a soft launch — use the `…-test-…` keys and **skip
> `STYTCH_API_URL`** (it defaults to the test endpoint). Test still emails anyone now that billing
> is on. Just remember the redirect URL (step 6) must be allowlisted under the **same** env.

## 5. Deploy

```sh
npm run deploy        # = VITE_REMOTE=1 vite build && wrangler deploy
```

On success wrangler prints your Worker URL, e.g. `https://quota.<your-subdomain>.workers.dev`.
The `v1` Durable Object migration runs automatically on this first deploy.

## 6. Allowlist the deployed URL in Stytch (required)

Stytch only sends magic links to allowlisted redirect URLs. In the Stytch dashboard
(**Redirect URLs**, under the **Live** env if you used live keys), add — for **Login** and
**Signup**:

```
https://quota.<your-subdomain>.workers.dev/
```

(Exactly the origin + `/`. If you later add a custom domain, allowlist that origin too.) Without
this, sign-in returns `could not send the sign-in email`.

## 7. Smoke-test the live deployment

1. Open `https://quota.<your-subdomain>.workers.dev`.
2. Sign in with your email → click the **real** magic link in your inbox → you land signed in.
3. Optionally set a display name on the Account page.
4. **New page** → add a slot → open the public link (in another browser/incognito) → sign in
   there → **Book**. Confirm it never oversells (a capacity-1 slot fills once).
5. As the owner, open the editor → **Export** downloads the bookings NDJSON.

## Custom domain (optional)

In the Cloudflare dashboard: **Workers & Pages → quota → Settings → Domains & Routes → Add custom
domain** (your domain must be on Cloudflare). Then **re-add that origin** to Stytch's redirect
URLs (step 6).

## Updating / redeploying

```sh
npm run deploy        # rebuilds the SPA and redeploys the Worker
```

D1 data and the per-page Durable Objects persist across deploys. New registry columns would need
a new `wrangler d1 execute … --remote` migration; the DO `Page` state is untouched by redeploys.

## Rollback

```sh
npx wrangler deployments list         # find a previous version id
npx wrangler rollback [version-id]    # roll the Worker back
```

## Notes & gotchas

- **`.dev.vars` is local-only** and gitignored; production reads `wrangler secret`s. Rotate any
  dev/test secret that has been shared (e.g. in chat) before relying on it.
- **`database_id` in `wrangler.toml`** must be the real id from step 2 for deploys; the
  placeholder only works for local `wrangler dev`.
- **Redirect URL mismatch** is the most common Stytch error — it must match the deployed origin
  exactly, under the env (Test/Live) whose keys you set.
- **Abuse / rate-limiting** on the public booking + auth endpoints is a trusted edge that isn't
  built yet (DESIGN_CLOUDFLARE §9) — add Cloudflare rate-limiting rules if you expect traffic.
- The verified core (`domain.ts`) runs identically in the browser and the Durable Object, so a
  deploy can't introduce booking-logic drift — only the trusted edges (auth, I/O, labeling) differ.
