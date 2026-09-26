@AGENTS.md

# Project memory — Instar

Read this before picking up any Instar work in this repo. It records what exists, why, and what's
still undecided, so a session can pick up cold instead of re-deriving context.

## What this repo is

`manvendrapant-sketch/Instar-fit` holds two things now:
1. A **frontend-only prototype** of the Instar coach dashboard (the "Today / Clients / Grow /
   Business" app), built in Next.js 16 (App Router). All data there is static/in-memory
   (`lib/data.ts`) — no auth, no DB, no Stripe. Treat it as the design/interaction reference for
   that dashboard only.
2. As of 2026-09-26, the **Commerce pillar backend groundwork** (Sprint 1) — real Postgres schema,
   a Stripe wrapper, a webhook endpoint, and the shared `/lib/commerce/types.ts` contract. See
   "Pillar 1 — Commerce" below. It was confirmed this same repo is the right place for it (the
   workplans' mention of Bitbucket was not followed here — see that section).

## How the dashboard build happened (for context, not repetition)

Two Claude artifacts were the source of truth:
1. An interactive concept (`instar-concept-round-1/3.html`-style file) — the actual copy, data
   (queue items, roster, space tiles) and interaction logic (approve/snooze queue rows, command
   palette, theme toggle). Several numbered "rounds" of this concept exist; round 3 (90KB, four
   design directions: Obsidian, Obsidian+, Stride, Still) is the fullest version seen so far, but
   only the coach-facing dashboard, not client-facing storefront/checkout screens.
2. A formal **Design System** artifact (type "Design System", files under `project/`:
   `tokens.json`, `components/bundle.css`, `README.md`) for the **Obsidian+** direction, which its
   own README declares "the client-approved look" — treat this as authoritative for styling; treat
   the concept file as authoritative for data/copy/behavior only.

The design system was republished once already (fonts Unbounded→Sora and Figtree→Hanken Grotesk,
a dedicated `blue` + gradient "hero" card for the MRR metric and each space's lead tile, and a
fully neutral sidebar nav with per-group colours removed). If asked to re-sync again, re-read the
live artifact (ask the user for its URL if not already in context) and diff `tokens.json` /
`components/bundle.css` / `project/README.md` against `app/styles/*.css` before assuming nothing
changed — file sizes/versions in a fresh `list` call tell you immediately if it moved.

**Structure**: `app/styles/{tokens,components,layout}.css` (tokens = colour/type/spacing vars per
theme; components = the design system's `.ins-*` component classes ported ~1:1; layout = page
chrome the component bundle doesn't cover — bar, sidebar shell, hero, grids, command palette,
toast, motion, responsive). `lib/data.ts` (content), `lib/store.tsx` (React context: theme, queue
done-state, toasts, nav/command-palette open state — persisted to `localStorage`), `lib/icons.tsx`
(inline SVG icon set). `components/*` (one component per concept UI piece). Routes: `/`,
`/clients`, `/grow`, `/business`.

**Branches**: `claude/blissful-ritchie-xnream` (first Obsidian+ build) → `updated-obsidian-plus`
(current tip, re-synced to the republished design system). Both pushed to `origin`.

**Deployment**: Vercel project `instar-fit` under the personal Hobby-plan account
(`manvendra-s-projects1` / `team_rTqJzCsTpprfKa0TvMCruWJO`), linked to this GitHub repo. **As of
2026-09-26 production deploys from `main`** (a push to `main` auto-deploys — confirmed by pushing
the Commerce/auth merge below and watching it build), not `updated-obsidian-plus` as this file
used to say; that note was stale, not a setting anyone changed on purpose. Public, no login wall
(`ssoProtection` explicitly disabled) — but `/`, `/clients`, `/grow`, `/business` now redirect to
`/login` for a signed-out visitor via `proxy.ts` (see "Login / signup APIs" below), so "no login
wall" now means the marketing/auth pages are public, not that the dashboard itself is:
- https://instar-fit.vercel.app
- https://instar-fit-manvendra-s-projects1.vercel.app

Vercel MCP quirk seen repeatedly this session: passing an explicit `teamId` to some endpoints
(`create_project`, `get_team`, `list_team_members`) 403s with a scope-mismatch error even though
the ID is correct; the same calls succeed if `teamId` is simply omitted (the token infers its own
scope). Try without `teamId` first.

The account is **personal Hobby plan** — it cannot have additional team members/collaborators
without upgrading to a paid Team. There is also no invite-a-member tool exposed by this Vercel MCP
connector. Inviting someone (e.g. Pari) to get deploy access has to be done by the account owner
by hand: Vercel dashboard → Settings → Members (after upgrading if still on Hobby).

## The new workstream: Pillar 1 — Commerce

On 2026-09-26 the user (Manvendra) shared three reference documents for a **separate, much bigger
piece of work** — turning Instar into a real paid product for coaches:
- A "Pillar 1 — Commerce" feature table (image): storefront, offer types, mobile checkout,
  recurring billing + dunning, payout dashboard, refunds/disputes, subscription pause (all v1),
  plus v2: year-end earnings summary, discounts/founding-client pricing, client payment plans.
- `Workplan-Manvendra.md` — owns the payments core: Stripe Connect, Postgres schema, webhooks,
  billing engine, server-side APIs. 6 weekly sprints for v1, sprints 7–10 for v2.
- `Workplan-Pari.md` — owns everything coaches/clients see: public storefront, mobile checkout,
  coach dashboards, client self-serve. Builds against the shared types Manvendra publishes.

Both workplans reference an **Obsidian vault** (`Decisions.md`, ticking tasks) and PRs going to
**Bitbucket**. When asked, Manvendra confirmed the Commerce build (schema, `/lib/commerce`,
`/app/api`, storefront routes) goes in **this** GitHub repo instead — the Bitbucket/Obsidian
mentions in the workplans are stale for this project. A repo-root `Decisions.md` (see below)
replaces the Obsidian vault's decision log so it travels with the code.

### Week-1 decisions — RESOLVED 2026-09-26

See `Decisions.md` for the full rationale. Summary:
1. **Connect account type**: Express.
2. **Charge type**: destination charges with `on_behalf_of` set to the coach's connected account
   (client's statement shows the coach; disputes route to the platform first).
3. **Fee display**: a flat "Service fee" line item, never a labeled surcharge.
4. **Platform take rate**: 2% (`PLATFORM_TAKE_RATE_BPS=200`), taken as `application_fee_amount`.
5. **Money**: integer cents everywhere — adopted, not really a decision.

### Sprint 1 — done in this session (2026-09-26)

Lives on branch `feat/commerce-sprint1-foundations` (pushed, branched from
`updated-obsidian-plus` since that was the tip at the time — not merged anywhere yet; **merge
target for Commerce branches is undecided**: `main` is still just the empty initial commit, so
don't assume Commerce should route through the dashboard's `updated-obsidian-plus` branch either.
Ask before merging/opening a PR).

Implemented directly (repo target was confirmed, so no need to wait):
- `lib/commerce/schema.ts` — Drizzle ORM schema for all 11 Sprint-1 tables (`coaches`,
  `connected_accounts`, `offers`, `prices`, `clients`, `subscriptions`, `payments`, `refunds`,
  `disputes`, `payouts`, `webhook_events`). Generated migration at `drizzle/0000_*.sql`
  (`npm run db:generate` to regenerate after a schema change, `npm run db:migrate` to apply).
- `lib/commerce/types.ts` — the shared API contract Pari builds against. Includes the Sprint-1
  shapes (`CoachPublicProfile`, `OfferSummary`, `MoneyBreakdown`) plus forward-looking Sprint-2/3
  stubs (`OnboardingStatus`, `CheckoutQuoteRequest/Response`, `CreateCheckoutSessionRequest/Response`)
  so she can type against what's coming without waiting on it.
- `lib/commerce/money.ts` — the one place the service-fee (3%, `SERVICE_FEE_RATE_BPS`) and platform
  take rate (2%, `PLATFORM_TAKE_RATE_BPS`) are computed. `computeCheckoutBreakdown()` is the only
  function that should ever produce a `MoneyBreakdown`.
- `lib/stripe/client.ts` — lazy Stripe client via `getStripe()`.
- `lib/commerce/db.ts` — lazy Drizzle/postgres-js client via `getDb()`.
- `app/api/webhooks/stripe/route.ts` — verifies the Stripe signature, dedupes on `stripe_event_id`
  into `webhook_events` (`onConflictDoNothing`), returns 200. No per-event-type handling yet —
  that's Sprints 2–5, per the workplan.
- `scripts/seed-commerce.ts` (`npm run db:seed`) — one test coach (`maya-test`, matching the
  dashboard's "Maya Reyes" persona) with all three offer types and one test client.
- `.env.example` — documents every env var these need (`DATABASE_URL`, `STRIPE_SECRET_KEY`,
  `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_TAKE_RATE_BPS`,
  `SERVICE_FEE_RATE_BPS`). `.gitignore`'s blanket `.env*` rule now has a `!.env.example` exception.

**Important gotcha hit and fixed**: `lib/stripe/client.ts` and `lib/commerce/db.ts` must construct
their clients **lazily** (`getStripe()` / `getDb()`, not a top-level `const`). Next.js imports
every route module at build time to collect its config, so a top-level `new Stripe(...)` or
`postgres(...)` that throws when its env var is missing fails `next build` outright — even though
the route is never invoked during the build. Keep this lazy pattern for any future commerce code.
Similarly, the `server-only` package cannot be imported by `schema.ts` or `db.ts`: both are loaded
directly by `drizzle-kit` and by `scripts/seed-commerce.ts` via `tsx`, neither of which goes
through Next's bundler, so `server-only`'s guard trips immediately. Only add `server-only` to a
commerce file if nothing outside Next's own build/dev server will ever import it.

**Database**: Supabase project "Instar Fit" (org "Instar"). `postgres-js` is configured with
`prepare: false` in `db.ts` because Supabase's transaction-mode pooler (PgBouncer) doesn't support
prepared statements.

**This Claude Code sandbox cannot reach Postgres at all — confirmed, not assumed.** Outbound
network here only allows port 443 (HTTPS); a direct TCP test to the Supabase pooler's port 6543
timed out while port 443 to the same host connected instantly. This holds regardless of which
Supabase connection string is used (direct `db.*.supabase.co:5432` is also IPv6-only, a second,
independent reason it fails here). **Do not spend time retrying connection-string variants** if a
future session hits this again — go straight to the workaround below. It does not affect the
deployed app: Vercel's servers aren't behind this restriction, so the webhook route connects fine
once `DATABASE_URL` is set in the Vercel project's env vars.

**Workaround in use**: generate the migration as normal (`npm run db:generate`), then instead of
`npm run db:migrate`, compute the migration file's sha256 (`crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')`
— this is exactly what `drizzle-orm`'s migrator does internally, see `node_modules/drizzle-orm/migrator.js`)
and hand the user a combined SQL file: the migration's own SQL, plus
`CREATE SCHEMA IF NOT EXISTS "drizzle"; CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);`
plus an `INSERT` of that hash and the journal entry's `when` timestamp into that table. They paste
it into Supabase's SQL Editor (browser, not this sandbox — works fine over 443). This keeps
`drizzle-kit migrate`'s bookkeeping correct so a *future* migration, run from anywhere with real DB
access, only applies what's actually new.

**Mistake made and fixed once already**: the very first handoff put the
`CREATE SCHEMA IF NOT EXISTS "drizzle"; CREATE TABLE IF NOT EXISTS ...` bookkeeping-table creation
only in the *first* migration's file, on the assumption the user would always run files in order
and each one would build on a database state where earlier files had already succeeded. That
assumption broke in practice (got a `relation "drizzle.__drizzle_migrations" does not exist` error
on the second file) — don't repeat it. **Every** hand-off file must independently include the
`CREATE SCHEMA IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` bookkeeping lines (harmless to repeat)
and should guard its `INSERT` with `WHERE NOT EXISTS (SELECT 1 FROM ... WHERE hash = ...)` so it's
safe to re-run if something upstream already partially succeeded. Treat each file as fully
self-contained and idempotent — never assume a prior file in the sequence actually ran.

Three migrations have gone out this way so far: `0000_special_hellfire_club.sql` (initial schema),
`0001_tiny_hobgoblin.sql` (RLS enablement, see `Decisions.md`), and `0002_dazzling_risque.sql`
(adds `coaches.password_hash` for the login/signup APIs below).

**Not done / needs the user**: migrations 0000-0002 were handed to the user to apply manually (see
above) — **still unconfirmed as of the 2026-09-26 merge/deploy below.** This is the one real
unknown hanging over that deploy: `DATABASE_URL` is now set in Vercel (see "Merged to `main` and
deployed" below) so the API routes can *reach* Postgres, but if the schema/`password_hash` column
aren't actually there yet, signup/login will fail with a DB error in production, not a config one.
Confirm this before trusting a report that auth "works" — a build succeeding and a deployment going
`READY` says nothing about whether these migrations ran. `db:seed` has the same port-443-only
problem and hasn't been run anywhere yet (needs either the user's machine, which has normal network
access, or hand-written INSERT SQL the same way as the migrations). No Stripe test-mode keys are
configured yet either. All of this is needed before Sprint 1's "done when" bar (Pari can hit mocked
routes; webhooks log in test mode) is actually met, not just compiles.

## Login / signup APIs (branch `feat/commerce-login-signup`, 2026-09-26)

Coach-only email/password auth — see `Decisions.md` for the full rationale (why coaches only,
why a JWT cookie instead of a sessions table, what's deliberately out of scope).

- `lib/auth/password.ts` (bcrypt hash/verify), `lib/auth/session.ts` (JWT session cookie,
  `AUTH_JWT_SECRET` env var — must stay a lazy read, same gotcha as Stripe/DB clients above),
  `lib/auth/validation.ts` (hand-rolled input validation — no validation library elsewhere in this
  app, so this doesn't introduce one either).
- `lib/api/response.ts` — the `{ success, message, data }` / `{ success: false, code, message,
  fields }` envelope every API route in this app should return, not just auth. Reuse it for any
  future route rather than inventing a new shape.
- Routes: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`.
- Not done: email verification, password reset, and rate limiting were out of scope for this ask —
  flag if any should land before real coaches sign up with this.

### Frontend wired to the login/signup APIs (same branch, later same day)

The `login-feature` branch (Pari/Manvendra's frontend-only sign-up/log-in pages — `app/(auth)/*`,
`components/{Signup,Login}Form.tsx`, `components/AuthFields.tsx`, `lib/auth.ts`) was merged into
this branch and wired to the real backend above. It had gone frontend-only deliberately (see its
own last commit, "Make sign up and log in frontend-only") pending exactly this.

- `lib/auth.ts` (frontend) gained `signup()`/`login()`/`logout()` fetch wrappers and `initialsFor()`;
  its existing client-side validators still run first for instant feedback, but the backend is the
  real source of truth. Forms map the API's `fields` onto their own field errors and `toast()` (the
  existing store-driven toast) for anything else (e.g. `INVALID_CREDENTIALS`).
- The signup form only ever collected a name, not a handle — rather than add a field, the signup
  route now derives a unique handle from `displayName` itself (`lib/auth/handle.ts`). `SessionPayload`
  (`lib/auth/session.ts`) gained `displayName` so pages can render the signed-in coach's name
  straight off the JWT, no DB round trip.
- Added `proxy.ts` at the repo root as the route guard (Next 16 renamed `middleware.ts` to
  `proxy.ts` — see `AGENTS.md`, and don't rediscover this the hard way): redirects a signed-out
  visitor from `/`, `/clients`, `/grow`, `/business` to `/login`, and redirects an already-signed-in
  visitor away from `/login`/`/signup` back to `/`. This is also what makes the signup confirmation
  card's "Log in" link skip straight into the app instead of asking for credentials again — no
  frontend change needed for that, the proxy's redirect handles it.
- `(app)/layout.tsx` reads + verifies the session cookie server-side and passes real coach identity
  into `TopBar`/`Sidebar` (replacing the hardcoded "Maya Reyes"); `Sidebar` gained a working logout
  button.
- Verified in a dev server: proxy redirects both directions with a hand-crafted signed cookie, the
  dashboard rendering that cookie's real name/initials, logout clearing the cookie and re-triggering
  the guard, and the signup/login forms' success/field-error/toast paths against mocked API
  responses (screenshotted, not just asserted). The actual DB-backed insert/lookup inside
  signup/login still can't be exercised from this sandbox — same Postgres-pooler restriction as
  everything else in this file — so that path is unit-reasoned, not screenshotted.

### Merged to `main` and deployed (2026-09-26)

Requested by Manvendra directly: `feat/commerce-login-signup` (backend + frontend wiring + Jest
suite, everything above) merged into `main` and pushed straight to `origin` — no PR opened (none
was asked for; the repo's audit above already flagged that PRs here get instantly self-merged with
no review anyway, so a direct push isn't a meaningfully different risk). `main` had moved since the
last session (someone merged the frontend-only `login-feature` PR straight into it separately, PR
#3) — merged cleanly, no conflicts, since this branch already contained that same content from its
own earlier `login-feature` merge.

Pushing to `main` auto-triggered a Vercel production deployment (confirms production now deploys
from `main`, not `updated-obsidian-plus` — see "Deployment" above). Before that deploy could
actually work, **`filter_project_envs` showed the Vercel project had zero environment variables
set at all** — not `DATABASE_URL`, nothing. Set via the Vercel API (`create_project_env`, type
`encrypted`, target `production`+`preview`+`development`):
- `DATABASE_URL` — the real Supabase pooler connection string.
- `AUTH_JWT_SECRET` — freshly generated (`crypto.randomBytes(32).toString('base64')`), **not** the
  `local-dev-only-...` placeholder that's in this sandbox's own `.env.local`. Rotating it logs out
  every existing session; there are no real users yet so that's free right now, not later.

Stripe env vars were deliberately left unset — no test-mode keys exist yet (see above), and nothing
login/signup does touches Stripe. `PLATFORM_TAKE_RATE_BPS`/`SERVICE_FEE_RATE_BPS` were also left
unset; `lib/commerce/money.ts` falls back to the documented 300/200 bps defaults either way.

The first auto-triggered deployment had already finished building *before* those env vars existed
(Vercel bakes env vars into a deployment at build time), so it was redeployed
(`create_deployment` with that deployment's id, `target: "production"`) — the second one picked up
the new vars and is what's actually live. Confirmed `READY` and aliased to both production domains
via `get_deployment`.

**Could not fully verify the live site from this sandbox**: this sandbox's egress proxy 403s a
direct `curl` to `*.vercel.app` (organization policy, unrelated to the deployment itself — same
kind of network restriction as the Postgres-pooler one elsewhere in this file, just a different
host), and the Vercel MCP connector's own `web_fetch_vercel_url` also declined ("Vercel denied
access... ask the user to update their Vercel connection"). `get_runtime_logs`/`get_runtime_errors`
also both 403 ("You don't have permission to access this resource") regardless of whether `teamId`
is passed — this connector cannot read this project's logs from this session, full stop; don't
keep retrying that path in a future session, ask the user to paste the Vercel dashboard's log
output instead. So: the build succeeded, the env vars were set, the deployment was live and aliased
— but nobody had actually exercised signup/login against the real production DB yet.

### Two real bugs found from that gap, fixed same day

Manvendra reported after trying the live site: **login with a non-existent account 500s, the
button stays stuck in its loading state, and no error message shows** — and **signup also 500s**.
Root-caused and fixed without needing the logs above:

1. **`lib/commerce/db.ts` had no `ssl` option.** `postgres-js` defaults to `ssl: false`, and
   `DATABASE_URL` has no `?sslmode=` query param to override that — but Supabase rejects
   unencrypted external connections outright, on both the pooler and the direct port. Every DB
   call was throwing before it ever reached SQL. Fixed: `ssl: 'require'`. This is almost certainly
   the actual cause, independent of whatever migrations 0000-0002's status turns out to be —
   nothing could have worked without this regardless.
2. **Neither route caught its own DB errors.** An uncaught rejection inside a Route Handler's
   async function becomes Next's bare framework 500 — no JSON body, no message, nothing the
   frontend can parse or show. Both `app/api/auth/{login,signup}/route.ts` now wrap their DB work
   in try/catch, log the real error server-side (`console.error`, so Vercel's own log capture gets
   it even though this session's tools couldn't read it back), and return the normal `apiError`
   envelope (`INTERNAL_ERROR`, 500) instead. Signup's existing insert-conflict catch was also
   tightened to only treat a genuine Postgres unique-violation (`err.code === '23505'`) as the
   409 "email/handle taken" case — anything else now correctly falls through to the same
   `INTERNAL_ERROR` path rather than being misreported as a conflict.
3. **The frontend's `postJson` (`lib/auth.ts`) could throw**, on a fetch failure or on `res.json()`
   failing to parse a non-JSON response (exactly what bug 2 was producing). Since neither
   `LoginForm` nor `SignupForm` caught that, the `setPending(false)` right after the `await` never
   ran — this alone, independent of the two backend bugs, is what left the login button stuck with
   no message. Fixed at the source (`postJson` now catches and returns a normal `{ success: false,
   code: 'NETWORK_ERROR', ... }` result instead of throwing) and defensively in both forms
   (`.finally(() => setPending(false))` instead of a bare sequential `setPending(false)` after the
   `await`), so a similar bug introduced later in either layer alone can't reproduce this.

All three shipped with tests in the same commit (the standing rule from "Testing (Jest)" above,
not an exception to it) — see `lib/commerce/db.test.ts` (asserts `ssl: 'require'` is actually
passed to `postgres()`), both routes' `route.test.ts` (DB-throws → 500, and the unique-violation
`.code` distinction), and `lib/auth.test.ts` (non-JSON response, fetch rejection).

**Still not independently confirmed**: whether migrations 0000-0002 are actually applied. The SSL
fix alone may be the entire story, or the migrations gap may still bite once TLS stops masking it —
this needs a real signup attempt against the live site to know for sure, same as before.

### Still open / next up

- Pari's side (frontend only, all mocked in `localStorage` via `lib/store.tsx`, no API routes): storefront
  editor `/business/storefront` (`lib/storefront.ts`), offer builder `/business/offers` (`lib/offers.ts`),
  Connect payouts `/business/payouts` (`lib/payouts.ts`, with dashed "prototype controls"), and on
  `feat/storefront-public` the public page `/[handle]` (`app/(public)/[handle]`, `lib/publicStorefront.ts`)
  plus Publish, locked until payouts are ready. Until `GET /api/coach/[handle]` exists, `/[handle]` can
  only show the coach's own page from their browser or the demo coach `maya-test`; anyone else sees
  "not found". Storefront links are written `instar.co/<handle>` (path, matching `/[coachHandle]`).
  Fields the UI collects that `lib/commerce/types.ts` doesn't carry yet: storefront specialties,
  coaching mode, location, time zone; offer includes, program weeks, session minutes, visibility.
- ORM choice (Drizzle, not Prisma) was an engineering call made without asking — revisit if there's
  a reason to prefer Prisma.
- Database provider: Supabase (the connection string in use is a Supabase pooler) — matches "This
  Claude Code sandbox cannot reach Postgres" above.
- Login/signup has no email verification, password reset, or rate limiting yet (see above).
- Once migrations 0000-0002 are actually applied (see "Not done / needs the user" above), do a real
  signup → login → logout pass against the live DB from somewhere with real network access — this
  session could only verify the wiring with a hand-crafted JWT and mocked API responses, not the
  actual insert/lookup.
- **Verify the live site**: try an actual signup on https://instar-fit.vercel.app — see "Merged to
  `main` and deployed" below for why this specific session couldn't confirm it itself.

### Process audit vs `Workplan-Manvendra.md` (2026-09-26) — gaps found, not yet fixed

Checked this repo's actual state against the workplan's own "Working agreement" rules:

- **"Pari reviews every PR" is not happening.** Checked both merged PRs via the GitHub API: PR #1
  (`updated-obsidian-plus`) and PR #2 (`feat/commerce-sprint1-foundations`) were each opened and
  merged by the same author within ~9 seconds of each other, zero reviews on either. If this rule
  still matters, it needs enforcing (branch protection requiring review) rather than trusting habit.
- ~~**"Every PR includes... tests for webhook handlers" is not happening either.**~~ **Fixed
  2026-09-26** — see "Testing (Jest)" below. Every existing route (including the webhook handler
  the workplan calls out by name) now has a test file, and it's now a standing rule that new
  functionality ships with tests rather than something to revisit later.
- The Sprint 1 section above's "not merged anywhere yet... ask before merging/opening a PR" language
  is stale now that PR #2 already merged straight to `main` same-day — `main` is the de facto merge
  target for Commerce branches now, whatever the earlier uncertainty says.
- The workplan's own assumption ("auth... already exist[s]") didn't hold for this repo — there was
  no auth until this session's login/signup work, which isn't one of the workplan's numbered sprint
  tasks. Worth reconciling with Manvendra/Pari so the workplan's sprint numbering and this repo's
  actual state don't drift further apart.
- Also still pending, unrelated to process: migrations 0000-0002 and `db:seed` unconfirmed as run
  against the real DB (see above), no Stripe test-mode keys configured, and `AUTH_JWT_SECRET` isn't
  set in Vercel's project env vars yet — signup/login will 500 in production without it.

## Testing (Jest, added 2026-09-26)

Requested by Manvendra directly, and closes the process-audit gap above. `npm test` /
`npm run test:watch`. 15 suites, 117 tests, ~4s, covering every route handler that existed at the
time (`/api/auth/{signup,login,logout,me}`, `/api/webhooks/stripe`), `proxy.ts`, every `lib/auth/*`
and `lib/commerce/money.ts` module, the two lazy-client gotcha files (`lib/stripe/client.ts`,
`lib/commerce/db.ts`), and the frontend's `lib/auth.ts`. Not covered: React component rendering
(`SignupForm`/`LoginForm`/`TopBar`/`Sidebar` etc.) — that needs jsdom + React Testing Library, a
separate setup this pass didn't add; ask if that's wanted too.

**Going forward: any new functionality (a route, a `lib/` module, a non-trivial component) ships
with a test file in the same change, not as a follow-up.** This is now a standing rule, not
something to revisit per-task.

- **Convention**: colocated `*.test.ts` next to the file it tests (e.g. `lib/auth/handle.ts` →
  `lib/auth/handle.test.ts`), not a separate `__tests__/` tree — makes an untested file obvious.
- **Setup**: `jest.config.ts` uses `next/jest` (loads `next.config.ts`/`.env*`, SWC transform).
  `testEnvironment: 'node'` project-wide (Route Handlers and `lib/` code never touch the DOM) —
  add a per-file `/** @jest-environment jsdom */` docblock if a future test needs it instead.
  `jest.setup.ts` sets a shared `AUTH_JWT_SECRET` for tests; it deliberately leaves
  `DATABASE_URL`/`STRIPE_SECRET_KEY` unset since `lib/commerce/db.test.ts` /
  `lib/stripe/client.test.ts` test the missing-env-var throw themselves.
- **Two non-obvious config fixes, don't re-discover these**:
  - `moduleNameMapper` needs an explicit `^@/(.*)$` → `<rootDir>/$1` entry. next/jest's SWC
    transform resolves the `@/*` alias inside ordinary `import` statements at compile time, so
    those never needed one — but a runtime string like `jest.mock('@/lib/commerce/db')` is just a
    value, never transformed, and silently fails to resolve without this.
  - jose (used by `lib/auth/session.ts`) ships pure ESM with no CJS build, so Jest can't
    `require()` it without help — but next/jest's own `transformIgnorePatterns` default already
    excludes `node_modules` except a hardcoded allowlist that doesn't include `jose`, and it only
    ever *appends* whatever you pass into `config`, never lets you override that default. See
    `jest.config.ts`'s `resolveConfig()` for the fix (rewrites next's own default patterns in place
    to add `jose` to the allowlist, after next/jest has built its config, instead of fighting the
    merge).
  - `server-only` needed no fix — next/jest already maps it to a no-op by default.
- **Mocking the DB layer**: `jest.mock('@/lib/commerce/db')` + cast `getDb as jest.Mock` to control
  what `db.query.<table>.findFirst(...)` / `db.insert(...).values(...).returning()` resolve to per
  test (see any `app/api/auth/*/route.test.ts` for the pattern). Don't try to faithfully mock
  Drizzle's query builder generally — a fake shaped to exactly what the route under test calls is
  enough, and simpler to read.
- Route Handler tests import the route's exported `POST`/`GET` and call it directly with a plain
  `Request` (or `NextRequest` for `proxy.ts`) — no server, no HTTP round trip. `next/headers`'s
  `cookies()` needs `jest.mock('next/headers')` (it throws outside a real request context); a
  Route Handler's own `NextResponse.json(...).cookies` does not.

### Working conventions to carry into any Commerce code

- Money is always integer cents + ISO currency — never floats.
- Webhook handlers are idempotent (dedupe on Stripe event ID, store in `webhook_events`).
- Never compute prices or fees in the browser — `lib/commerce/money.ts` (server-only) is the only
  source; the UI only displays what an API returns.
- `/lib/commerce/types.ts` is the one contract; flag any change to it rather than editing quietly.
- Stripe test mode + test clocks only until the Sprint 6 "hardening & launch" milestone.
- Branch naming: `feat/commerce-<short-name>` (Manvendra), `feat/storefront-<short-name>` (Pari).
- Any Stripe client / DB client constructed at module scope must be lazy (see gotcha above).
- New functionality ships with a test file in the same change — see "Testing (Jest)" above.
