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

- Pari's public storefront page `/[handle]` (`app/(public)/[handle]/`, merged from
  `feat/storefront-public`): server-rendered from `GET /api/coach/[handle]` via
  `lib/publicStorefront.ts`'s `loadPublicProfile` (absolute URL from `lib/publicOrigin.ts`,
  deduped per request with React `cache` in `load.ts` so page + `generateMetadata` +
  `opengraph-image.tsx` share one fetch). Unknown/unpublished → "no coach here" (noindex); API
  failure → "didn't load"; the signed-in owner of an unpublished page gets `OwnerPreview`, built
  from their own profile + active offers. Offer buttons toast "checkout coming soon" until Sprint 3.
  The storefront page's publish card is `components/StorefrontPublish.tsx` (why-it's-locked steps,
  "You're live" + copy link, unpublish) on top of `GET/PATCH /api/storefront`; the server's
  `canPublish` decides, the steps only explain. Storefront links are written `instar.co/<handle>`.
- **Signed-out pages skip coach-only fetches**: `app/layout.tsx` passes `signedIn` (session cookie
  present) into `AppStateProvider`, which otherwise fired `/api/offers`, `/api/coach/*`,
  `/api/storefront` on every page, including `/login`, `/signup` and the public storefront, where
  they 401 and toast an error at a visitor who isn't a coach.
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
  **A Claude Code session's own harness-assigned branch (e.g. `claude/<adjective>-<name>-<id>`) is
  not this** — rename it to the proper `feat/commerce-<short-name>` (or `feat/storefront-<short-name>`
  for Pari's work) before finishing/handing off, don't leave Commerce work sitting on the generic
  session name. Confirmed 2026-09-26 after doing exactly that rename (harness branch →
  `feat/commerce-storefront-apis`) at Manvendra's explicit request.
- Any Stripe client / DB client constructed at module scope must be lazy (see gotcha above).
- New functionality ships with a test file in the same change — see "Testing (Jest)" above.

## Storefront APIs — Pari's frontend workplan, backend half (2026-09-26)

Manvendra shared Pari's five-item frontend workplan (`storefront-checklist`, `-offers`, `-payouts`,
`-publish`, `-public` — all frontend-only with mock data until these exist) plus Stripe test-mode
keys, and asked for the APIs those branches need, built ahead of the UI — same "mocks now, wire up
the real thing later" pattern as the rest of Commerce. The test-mode keys (`sk_test_...` /
`pk_test_...`, pasted directly in chat) went straight into this sandbox's own `.env.local` — never
committed (confirmed gitignored via `git check-ignore -v .env.local`) and not yet set in Vercel (no
storefront route is deployed against them yet; that's a "once Pari's UI is ready" step).

**Schema**: migration `0003_sad_diamondback.sql` adds `coaches.published` (bool, default false —
gates the public storefront) and `offers.position` (int, default 0 — the offer builder's
reordering). **Same unconfirmed-migration situation as 0000-0002**: generated here, not applied
anywhere — this sandbox still can't reach Postgres (see "This Claude Code sandbox cannot reach
Postgres" above, unchanged since that section was written). Hand off the same way: the migration's
own SQL plus drizzle's bookkeeping-table insert, pasted into Supabase's SQL Editor by the user.

**New routes** (the `{ success, message, data }` envelope from `lib/api/response.ts`, all
authenticated via the new `lib/auth/require-coach.ts` unless noted public):
- `GET /api/offers`, `POST /api/offers` — the offer builder's list and create. Create also creates
  the backing Stripe Product + Price (test mode) via `lib/commerce/offers.ts`'s
  `createStripeProductAndPrice`, so real ids exist for Sprint 3 checkout to use later even though
  checkout itself is out of scope here.
- `PATCH /api/offers/[id]` — edit name/description/active, or replace the price. Stripe Prices are
  immutable, so a price change creates a new Stripe Price + DB row and retires (`active: false`)
  the old one rather than mutating it.
- `PATCH /api/offers/reorder` — body `{ orderedIds }`, must be exactly a permutation of the coach's
  own offer ids (not a subset, not anyone else's); writes each offer's new `position` in one
  transaction.
- `GET /api/offers/quote?unitAmountCents=&currency=` — the offer builder's live "you'll receive"
  preview: wraps `lib/commerce/money.ts`'s `computeCheckoutBreakdown` with a `coachReceivesCents`
  field (`baseAmountCents - platformFeeCents`).
- `GET /api/coach/onboarding-status` — fills in the Sprint-1 stub already in `types.ts`, backed by
  the new `lib/commerce/connect.ts`'s `deriveConnectStatus` — the one place Stripe's own
  charges/payouts/details-submitted/requirements-due flags map onto our `ConnectStatus` enum, used
  by both this route and the publish gate below so the two can't drift apart.
- `POST /api/coach/connect/account-link` — creates the coach's Stripe Express account on first call
  (reused after), then always issues a fresh Account Link (`account_onboarding`) since Stripe's
  links expire in minutes; returns `{ url }` to redirect to. Return/refresh paths default to
  `/business`, overridable via the request body once Pari's payouts screen has its own route.
- `GET /api/storefront`, `PATCH /api/storefront` — status (`published`, `canPublish`,
  `connectStatus`, `publicUrl`) and the publish/unpublish toggle. `canPublish` requires
  `connectStatus === 'ready'` AND at least one active offer; publishing without both 422s
  `NOT_READY`. Unpublishing (hiding the storefront again) has no gate.
- `GET /api/coach/[handle]` — the public storefront page's data, no auth. 404s unless
  `coaches.published` is true; returns only active offers ordered by `position`. Matches the
  `CoachPublicProfile` shape already documented in `types.ts`.

New shared types in `lib/commerce/types.ts`: `CoachOfferSummary`, `CreateOfferRequest`,
`UpdateOfferRequest`, `ReorderOffersRequest`, `OfferQuoteResponse`, `StorefrontStatus`,
`UpdateStorefrontRequest`, `CreateAccountLinkRequest`/`CreateAccountLinkResponse`.

**New shared helper**: `lib/auth/require-coach.ts` (`requireCoachSession()`) — the cookie-read +
verify steps `GET /api/auth/me` had inlined, pulled out once eight more routes needed the same
three lines.

Every new module/route shipped with a test file (standing rule, see "Testing (Jest)" above) — 58
new tests (`npm test`: 26 suites, 175 tests total now, ~5s). Also verified `npm run build` succeeds
with `DATABASE_URL`/`AUTH_JWT_SECRET`/`STRIPE_SECRET_KEY` all unset (the lazy-client convention
holding for every new route) and that `npx eslint .` / `npx tsc --noEmit` are both clean.

**Not done / deliberately out of scope for this pass**:
- No live Stripe verification — `.env.local` now has real test-mode keys, but nothing here was
  exercised against the actual Stripe test API (same network restriction as everywhere else in this
  file); only unit tests with `getStripe`/`getDb` mocked ran.
- ~~`account.updated` webhook handling (to refresh `connectedAccounts.chargesEnabled` /
  `payoutsEnabled` / `requirementsDue` from Stripe) is still Sprint-2+ per the workplan — the
  webhook route still only dedupes, so a real coach's `onboarding-status` will read
  `not_started`/`action_needed` indefinitely until that lands.~~ **Sidestepped, not built** — see
  the live-Stripe incident section far below: `onboarding-status` now asks Stripe directly
  (`accounts.retrieve`) on every call instead of waiting on a webhook that still doesn't exist.
- ~~Deleting/archiving an offer beyond `active: false` wasn't asked for and isn't implemented.~~
  **Added in the frontend-integration pass below** (`DELETE /api/offers/[id]`) once the merged
  offer builder turned out to have a real delete button.
- Mobile checkout (Sprint 3) and everything after it in Pari's workplan is explicitly not part of
  this ask.

## Frontend wired to the real storefront APIs (2026-09-26, later same day)

Manvendra asked to pull the latest `main` (Pari had meanwhile merged her offer builder, payouts
screens and storefront creator — all still frontend-only mock data, per her own workplan) and
integrate this session's backend into it, then rename the session's own harness-assigned branch to
the proper `feat/commerce-<short-name>` convention (see "Working conventions" above — that bullet
now has the "rename the harness branch" clause this session added). Done as
`feat/commerce-storefront-apis`; the merge was clean (no file both sides touched with conflicting
changes — `lib/commerce/types.ts` only got additive changes here).

**The frontend's mock modules assumed fields the contract didn't have yet** — flagged in their own
comments ("flag to Manvendra before wiring the real API"), and now added:
- `offers.includes` (jsonb string[]), `offers.length_weeks`, `offers.session_minutes` — the offer
  builder's "what's included", program length and session length fields.
- `coaches.specialties` (jsonb string[]), `coaches.location`, `coaches.coaching_mode` (new enum
  `online`/`in_person`/`both`) — public storefront-profile fields the storefront creator collects.
- `coaches.time_zone` — private (never on the public profile; used for session/check-in times).
- `coaches.storefront_completed_at` (nullable timestamp) — replaces the old frontend's "is
  `storefront` null" check for "has this coach set up a storefront yet"; exposed as `completed`
  on `CoachProfile`/`GET /api/coach/profile`, not the raw timestamp.

All four landed in migration `0004_shocking_nomad.sql` — **same unconfirmed/unapplied situation as
0000-0003**, handed off to the user as SQL the same way (this sandbox still has no Postgres
access).

**New route**: `GET /api/coach/profile`, `PATCH /api/coach/profile` — the storefront creator's own
profile (a superset of the public `CoachPublicProfile`: same fields plus `timeZone` and
`completed`). PATCH always takes the whole profile (the creator always submits the full draft, so
there's no partial-update variant like offers has). Validation lives in the new
`lib/commerce/profile.ts` — handle format AND a reserved-word list (`login`, `signup`, `business`,
`clients`, `grow`, `api`, `app`, `admin`, `help`, `support`, `instar`) that would collide with an
app route once the public storefront lives at `/<handle>`; the frontend's own `lib/storefront.ts`
checks the same list client-side for instant feedback — **keep the two lists in sync**. Handle
*uniqueness* (taken by another coach) is a separate DB check in the route itself, reported as a 409
`HANDLE_TAKEN` the same way signup reports a taken email. Changing the handle or display name
reissues the session JWT (same pattern as nothing before this — first place a non-auth route needed
to touch the session cookie) so the sidebar/topbar don't keep showing stale values until the coach
logs in again.

**`DELETE /api/offers/[id]`** — added because the merged offer builder has a real delete button
(not just hide via `active: false`). Hard-deletes the offer row (`prices.offerId` cascades); best-
effort archives the Stripe product (`products.update({active:false})`) — a failure there doesn't
fail the delete, since nothing reads a deleted offer's Stripe ids again.

**Frontend rewiring** (all under `lib/`, following the existing `lib/auth.ts` fetch-wrapper
pattern, now extracted once three more files needed the same fetch/error-envelope logic):
- New `lib/api-client.ts` (`apiFetch`, `ApiResult<T>`) — the one fetch-plus-envelope helper;
  `lib/auth.ts`'s own `postJson` is now a two-line wrapper over it, kept for import-path
  compatibility with its existing callers/tests.
- `lib/offers.ts`: `OfferDraft` is now a straight alias for the contract's `CoachOfferSummary`
  (rather than its own frontend-only interface) — `visible` became `active` throughout (the field
  the backend already used); added `fetchOffers`/`createOfferApi`/`updateOfferApi`/`deleteOfferApi`/
  `reorderOffersApi` plus `toCreateRequest`/`toUpdateRequest` request-shape builders.
- `lib/payouts.ts`: dropped the mock-Stripe-outcome stand-in (`mockStatusAfter`, `isMockResult`,
  `MOCK_RESULTS`, `MOCK_READY` — all gone) now that a real Connect flow exists; added
  `fetchOnboardingStatus`/`createAccountLink`.
- `lib/storefront.ts`: `StorefrontDraft` is now an alias for `CoachProfile`; `CoachingMode` moved to
  `lib/commerce/types.ts` (re-exported here for compatibility); added `fetchProfile`/`saveProfile`/
  `setStorefrontPublished`/`toUpdateProfileRequest`. `withStorefrontDefaults` still exists but its
  job changed: it now builds a full draft from the session JWT's handle/displayName while
  `GET /api/coach/profile`'s real answer is loading, not "backfill an old localStorage draft" (there
  is no localStorage draft anymore).
- `lib/store.tsx` (`AppStateProvider`): `offers`/`payouts`/`storefront` are no longer
  `useState` + `localStorage`-persisted mocks — they're loaded from the three GET routes above on
  mount (in parallel) and exposed with `refreshOffers`/`refreshPayouts`/`refreshStorefront`
  functions instead of setters; a new `storefrontStatus` (from `GET /api/storefront`) plus
  `refreshStorefrontStatus` backs the publish toggle. `hydrated` now means "local prefs read AND
  all four server fetches settled," not just "localStorage read." Components call the `lib/*.ts`
  API functions directly (for field-error handling) and then call the matching `refresh*()` rather
  than the old context methods doing the mutation themselves — mirrors how the login/signup forms
  already worked, just extended to three more resources. `theme`/`done`/`storefrontPromptDismissed`
  are still local-only preferences, unchanged.
- Every component that read `storefront` as "null until created" now reads `storefront?.completed`
  instead (`storefront` itself is non-null once loaded, per the schema note above): `OffersList`,
  `PayoutsPage`, `Sidebar`'s "Set up" badge, `StorefrontPrompt`. Missed this once for `Sidebar.tsx`
  on the first pass (it type-checks fine either way — `!storefront` vs `!storefront?.completed` are
  both valid `boolean`s — so this is a "caught by rereading the diff," not a compiler error).
- `PayoutsConnect`'s "Continue to Stripe" now calls the real `createAccountLink()` and redirects to
  the actual Stripe URL; `PayoutsConnect`'s old mock stand-in screen is gone. `PayoutsReturn` now
  fetches real onboarding status on return instead of reading a `?mock=` query param;
  `app/(app)/business/payouts/return/page.tsx` no longer reads/passes that param either.
- `StorefrontCreator`'s "done" panel gained the actual **Publish**/**Unpublish** step and button
  (`storefrontStatus.canPublish` gates it, same rule as the backend) — the old copy ("Publishing is
  coming in the next update") is gone now that `/api/storefront` has a real caller.

**Verified**: `npx tsc --noEmit`, `npx eslint .` and `npm test` (32 suites, 291 tests) all clean;
`npm run build` succeeds with `DATABASE_URL`/`AUTH_JWT_SECRET`/`STRIPE_SECRET_KEY` unset. Also
smoke-tested in a real dev server (Playwright, hand-crafted signed session cookie — same technique
as the earlier login/signup verification) across `/business`, `/business/offers(/new)`,
`/business/payouts` and `/business/storefront`: every page rendered without a React crash, and a
failed API call (expected here — no Postgres access) surfaced as the existing generic error toast
rather than a blank screen or thrown exception. **Not verified**: an actual create-offer /
connect-payouts / save-profile round trip against a real database, since this sandbox still can't
reach one — that needs the pending migrations 0000-0004 applied first (see above), from somewhere
with real network access.

**Not done / still open**:
- No live-Stripe or live-DB verification of this pass specifically (same standing gap as Sprint 1).
- Deleting/hiding an offer's Stripe product on delete is best-effort only (see above) — if Stripe
  itself is down, the offer still deletes but the Stripe product stays active; nothing reconciles
  that later.

### Migrations applied, deployed to `main`, then Storefront page was blank (2026-09-26)

Manvendra applied migrations 0000-0004 himself, then asked to push `main` and publish. Pushed
(fast-forward, `main` == `feat/commerce-storefront-apis`), and set `STRIPE_SECRET_KEY`/
`STRIPE_PUBLISHABLE_KEY` in Vercel (still unset until now — offers/payouts genuinely call Stripe as
of this branch, unlike the earlier login/signup-only deploy). **Same gotcha as the very first
Commerce deploy**: the git push's auto-triggered production deployment had already finished
building before those two env vars existed, so it shipped without them — redeployed
(`create_deployment` with that deployment's id) to pick them up. Confirmed `READY` and aliased to
both production domains.

Then: clicking **Storefront** in the sidebar showed a blank content pane. Root-caused from the code
alone (this sandbox still can't reach the live site or its logs — `get_runtime_errors`,
`get_runtime_logs`, `web_fetch_vercel_url`, a direct `curl`/`WebFetch` to `instar-fit.vercel.app` all
still refuse the same way documented above): `StorefrontCreator` returned `null` whenever
`GET /api/coach/profile` failed for *any* reason, with no error shown — only a toast that vanishes
after 2.6s. Fixed: it now renders a "Couldn't load your storefront" panel with a Try again button
(calling the existing `refreshStorefront()`) instead of silently rendering nothing. This is a real
bug independent of root cause and should have been there from the start (every other
failure-during-load path in this app shows *something*).

The likely actual trigger, unconfirmed without log access: migration `0004` (the one adding
`coaches.specialties`/`coaching_mode`/`time_zone`/`storefront_completed_at`) landed in the same
turn as the route that reads those columns — if it was applied a beat after Manvendra said
"migrations applied," or the handoff SQL was run out of order, `GET /api/coach/profile`'s
`SELECT` (drizzle generates the column list from `schema.ts`, not `SELECT *`) would 500 on a
missing column, exactly reproducing "nothing appears." Worth checking directly in Supabase's table
editor (do `specialties`/`coaching_mode`/`time_zone`/`storefront_completed_at` exist on `coaches`?)
before assuming the blank-panel fix alone resolved it — the fix makes the failure visible, it
doesn't remove whatever's actually causing it.

### The live-Stripe incident: login itself broke, then Connect account-link, then stale status (2026-09-26)

Confirmed the hypothesis above was right, the hard way: **login itself started 500ing** after the
migrations-applied deploy — not just the new Storefront page. Root cause, confirmed via
`information_schema.columns` and `drizzle.__drizzle_migrations` queries Manvendra ran directly in
Supabase (this session still has zero Postgres access, so this was the only way to actually see the
DB's state): **migration `0003_sad_diamondback` had never run** — only 0000, 0001, 0002 and 0004
were recorded. `db.query.coaches.findFirst()` has no column restriction, so Drizzle's relational
query builder selects *every* column `schema.ts` declares — once `schema.ts` included
`coaches.published` (from 0003), literally every coach-table query, login included, started asking
Postgres for a column that didn't exist. Lesson: **a later migration's bookkeeping row existing is
not evidence an earlier one ran** — check the specific columns a broken route touches, don't assume
sequential success from the newest hash being present.

**Immediate mitigation while diagnosing**: rolled production back to the last commit predating any
of these schema columns (`7cca508`, via `create_deployment` reusing that old deployment's id —
Vercel's dedicated `request_rollback` tool 402'd past one deployment back on this Hobby-plan
account, so a plain redeploy of the old commit was used instead). This restored login immediately
at the cost of pulling the just-shipped storefront/offers/payouts features back out of production
for a few minutes. Once Manvendra ran migration 0003's handoff SQL and confirmed it, redeployed
forward to the newer commit (`06cc2c4`, which also includes the StorefrontCreator blank-panel fix
above) and it was clean.

**Then Connect payouts 500'd** (`POST /api/coach/connect/account-link`). Same "no log access"
constraint, but this time Stripe's own dashboard gave the real answer directly (Developers → Logs,
Manvendra pasted the JSON): `"Stripe no longer recommends Accounts v1 for new Connect
integrations... enable Accounts v1 support in the Dashboard"`. **New Stripe accounts have the
classic `POST /v1/accounts` endpoint (what `stripe.accounts.create()` in the Node SDK calls) turned
off by default now** — this is a current Stripe platform policy, not a bug introduced by this repo.
Two paths: enable the "Accounts v1 support" compatibility toggle (dashboard →
Settings → Developers → API policies) as an immediate unblock, or migrate this repo's Connect
account creation to the newer Accounts v2 API (`POST /v2/core/accounts`) properly. **Only the quick
toggle has been done so far** — migrating to v2 is still open, flagged below.

Along the way, it turned out Manvendra had been doing the Connect platform-profile setup (business
model = marketplace, liability/compliance acknowledgements) inside a separate **Stripe Sandbox**
("Instar Sandbox") rather than the original account's plain test mode — sandboxes carry their own
API keys. `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` in Vercel were updated to the sandbox's keys
(and in this sandbox's own `.env.local`) once that surfaced, with a redeploy to pick them up.
**Whichever Stripe test-mode/sandbox environment the keys belong to is the one that must have the
Connect marketplace platform profile configured** — if test keys are ever rotated again, re-check
this pairing before assuming a fresh 500 is a code bug.

**Then, after actually completing Stripe's Express onboarding form for real** (business type,
professional details, personal details, a test bank account, confirmed) — the app's Payouts page
kept showing "Action needed / Stripe needs a few more details," not "Ready." This is the
`account.updated`-webhook gap called out above finally biting in practice: `connected_accounts`
only ever gets written once, at account-link creation time (all flags false, empty requirements),
and nothing was pushing Stripe's real post-onboarding status into that row. Rather than building
out real webhook handling (needs a registered public endpoint + signing secret, still not set up),
`GET /api/coach/onboarding-status` (`app/api/coach/onboarding-status/route.ts`) now calls
`stripe.accounts.retrieve()` live on every request, and opportunistically updates the cached
`connected_accounts` row when Stripe's answer differs from what's stored — a Stripe API hiccup
during that sync falls back to the last cached values instead of 500ing the whole endpoint. Shipped
with tests (`route.test.ts`): not-called-when-no-account, DB-write-on-drift,
no-write-when-unchanged, and fallback-on-Stripe-error.

**Still open**:
- Migrating Connect account creation to Stripe's Accounts v2 API — the "Accounts v1 support"
  dashboard toggle is a compatibility stopgap, not something to rely on indefinitely; Stripe's own
  error message says so explicitly.
- Real `account.updated` webhook handling still doesn't exist; the live-sync-on-read approach above
  is a reasonable substitute for a single-coach status check but doesn't scale to "notify the coach
  the moment Stripe finishes reviewing them" without the coach happening to reload the page.
- `db:seed` still hasn't been run anywhere (same port-443-only sandbox restriction as every other
  DB operation in this file).

### Two more bugs found live-testing after the incident above (2026-09-26)

**"Created a second account, but the app kept showing the first account's data."** Root cause:
this class of bug had already been found and fixed once, for login (`LoginForm.tsx` — `router.
push('/'); router.refresh();`, with a comment explaining why: Next's client Router Cache can
serve a stale pre-login RSC render of a route unless explicitly told to refetch) and for logout
(`Sidebar.tsx`, same pattern) — but not for signup's own post-success screen. `SignupForm.tsx`'s
"Account created" card linked to `/login` with a plain `<Link>`; since signup already sets the
session cookie, `proxy.ts`'s already-signed-in redirect would immediately bounce that to `/`
anyway — but without a `router.refresh()`, the client could still serve a cached "/" render from
*before* the account switch. Fixed: that card now has a "Continue" button doing the same
`router.push('/'); router.refresh();` as login/logout, skipping the pointless `/login` hop
entirely (signup already established the session — the card was only ever routing through
`/login` to lean on the proxy redirect, not because credentials were actually needed again).
**If a future auth-adjacent screen is added, it needs this same pair of calls** — there's no
single shared guard for it yet, just three call sites now following the same commented pattern.

**"The edit functionality for offers also does not work."** `lib/offers.ts`'s `toUpdateRequest`
sent every field on every edit, including `price` — unconditionally, even when only the name or
description changed. The backend treats a present `price` as "replace it": Stripe Prices are
immutable, so it always calls `stripe.prices.create()` on the offer's `stripeProductId` before
touching anything else. Two problems from that: wasted Stripe calls on trivial renames, and a hard
failure for any offer whose `stripeProductId` belongs to a Stripe account/key different from
whatever's currently configured — exactly the situation this same day's `STRIPE_SECRET_KEY`
rotation (original test mode → "Instar Sandbox") created for every offer made before the swap.
Fixed: `toUpdateRequest(o, original?)` now takes the offer as originally loaded and only includes
`price` in the request when it actually differs from `original.price`; `OfferEditor.tsx` passes
its already-available `existing` offer as that second argument. A pure rename no longer touches
Stripe at all. (An offer that genuinely needs its *price* changed, and whose product predates a
key rotation, will still hit this — recreating that specific offer is the practical workaround
for test data; nothing reconciles orphaned cross-account Stripe products automatically.)

Both shipped with tests — `lib/offers.test.ts` gained cases for `toUpdateRequest`'s
price-inclusion logic (no `original` → sends price; unchanged → omitted; changed → included).
`SignupForm`'s button change has no test, same as every other component in this repo (component
rendering tests still aren't set up — see "Testing (Jest)" above).

**The stale-account-data bug above was only half fixed by `router.refresh()`.** Manvendra reported
it was still there — the sidebar/topbar (server-rendered, reads the cookie directly) showed the
new account correctly, but the Offers page didn't, until a hard reload. Root cause: `router.
refresh()` only re-renders **server** components; `AppStateProvider`'s `offers`/`payouts`/
`storefront` state lives in a client-side `useState` and is only ever fetched once, in a mount
effect (`useEffect(() => {...}, [])`) — a client-side navigation (`router.push`) never unmounts
that provider (it wraps the whole app, in the root `app/layout.tsx`), so that effect never re-runs
and the previous account's data just sits there in memory. **Fixed properly this time**: login
(`LoginForm.tsx`), logout (`Sidebar.tsx`), and signup's "Continue" button (`SignupForm.tsx`) now
all do a full `window.location.href` reload instead of `router.push` (+ the now-insufficient
`router.refresh()`) — a full reload tears down and rebuilds the entire React tree, `AppStateProvider`
included, which is the only thing that reliably clears this. Each site has an
`eslint-disable-next-line @next/next/no-location-assign-relative-destination` — Next's own lint
rule pushes back on this exact pattern, but the client-side Router Cache it's steering people
toward is precisely what caused the bug.
**If a future screen needs to change who's logged in, it needs a full reload too — `router.push`+
`refresh()` is not enough**, whatever Next's lint rule suggests.

## Sprint 3 — Checkout backend (2026-09-27, branch `feat/commerce-checkout`)

Manvendra shared `Workplan-Manvendra.md` and asked what to pick next; recommended Checkout since
nothing else in the workplan can produce a real payment to test against until it exists. Branched
from `main` (which already has migrations 0000-0004 applied and the storefront/offers/payouts APIs
live). No schema changes needed — `offers.stripeProductId`/`prices.stripePriceId` already exist.

**New**: `lib/commerce/checkout.ts` (`createCheckoutSession`), `lib/commerce/clients.ts`
(`upsertClient`, keyed on `(coachId, email)` — no DB unique constraint on that pair, same
looser-than-ideal guarantee as elsewhere in this schema), `lib/commerce/webhookHandlers.ts`
(`dispatchWebhookEvent` plus one handler per event type), `GET /api/checkout/quote` (public — the
client-facing "what will I pay" preview), `POST /api/checkout` (public — creates the Stripe
Checkout Session; never writes `clients`/`subscriptions`/`payments` itself, only the resulting
webhooks do, so an abandoned checkout leaves no stray row).

**Charge shape follows the Week-1 decisions** (see `Decisions.md`): destination charges with
`on_behalf_of` the coach's connected account, the Service fee as its own Checkout line item (never
folded into the base price), Instar's cut as an application fee. One-time offers get an exact
`application_fee_amount`; subscriptions can only use `application_fee_percent` (a Stripe Connect
constraint), which necessarily also takes its cut of the Service-fee line, not just the base price —
a disclosed, intentional approximation, see `Decisions.md` for why this isn't worth fixing yet.

**Webhook handling now actually writes data**, not just dedupes:
- `checkout.session.completed` — upserts the client; for a subscription, also inserts the
  `subscriptions` row (retrieving the real Stripe status/`current_period_end` via
  `stripe.subscriptions.retrieve()`, since the Checkout Session event alone doesn't carry either).
- `payment_intent.succeeded` — writes a `payments` row, but **only** for one-time Checkout
  payments: it keys off `pi.metadata.offerId` etc. being present, which is only ever set on
  `payment_intent_data` for `mode: 'payment'` sessions. A subscription invoice's own PaymentIntent
  carries none of that metadata, so this is a no-op for it by construction, not by inspecting a
  `PaymentIntent.invoice` field — **that field doesn't exist in this app's pinned Stripe API version**
  (`2026-08-26.dahlia` moved invoice/subscription/charge linkage off PaymentIntent onto
  `invoice.parent.subscription_details` / `invoice.payments[]` — checked directly against the
  installed `stripe` SDK's `.d.ts` files, not assumed from training data; see `AGENTS.md`'s warning
  that this isn't the Stripe anyone's used before, same as it isn't the Next.js).
- `invoice.paid` — the source of truth for recurring payments. Joins `invoice.parent
  .subscription_details.subscription` back to our own `subscriptions` row to get `offerId`/
  `priceId`/`coachId` (via the row's `clientId` → `clients.coachId`), then **recomputes** the
  breakdown from that price's `unitAmountCents` via `computeCheckoutBreakdown` rather than trusting
  Stripe's own invoice amounts — keeps this the one place fees are computed, per the workplan's own
  "single source of truth" requirement. Marks the subscription `active` on first successful invoice.

**Webhook idempotency was tightened**: the pre-Sprint-3 route recorded an event and returned 200
before any handler existed, so "row exists" and "fully handled" were the same fact. Now that
handlers can throw partway through, `webhook_events.processedAt` (already in the schema, previously
unused) is the real marker — a conflict on insert with `processedAt` still null means a previous
attempt crashed before finishing, so it's reprocessed rather than silently dropped. See
`Decisions.md` for the full reasoning.

**All new/changed code shipped with tests** (standing rule): `lib/commerce/checkout.test.ts`,
`lib/commerce/clients.test.ts`, `lib/commerce/webhookHandlers.test.ts`,
`app/api/checkout/route.test.ts`, `app/api/checkout/quote/route.test.ts`, and a rewritten
`app/api/webhooks/stripe/route.test.ts` covering the new dispatch/reprocess-on-crash logic.
Verified: `npx tsc --noEmit`, `npx eslint .`, `npm test` (38 suites, 335 tests) all clean; `npm run
build` succeeds with `DATABASE_URL`/`AUTH_JWT_SECRET`/`STRIPE_SECRET_KEY` unset, and
`/api/checkout`/`/api/checkout/quote` both show up in the build's route list.

**Not done / deliberately out of scope for this pass**:
- No live-Stripe or live-DB verification — same standing gap as every other pass in this file (this
  sandbox can reach neither Postgres nor, unverified either way this time, Stripe's live API; only
  unit tests with `getDb`/`getStripe` mocked ran).
- **The public storefront's offer buttons still show "Checkout is coming soon"**
  (`components/PublicOfferList.tsx`) — wiring them to `POST /api/checkout` is Pari's mobile-checkout
  work per her own workplan (`storefront-checklist`'s Sprint 3), not part of Manvendra's backend
  ask answered here. `GET /api/checkout/quote` and `POST /api/checkout` exist and are tested, ready
  for that UI to call whenever it's built.
- No webhook endpoint is registered in Stripe's Dashboard yet and `STRIPE_WEBHOOK_SECRET` isn't set
  in Vercel — needed before any of this fires for real in production; still just the local/test
  path today, same gap Sprint 1 already flagged and this pass didn't close.
- Refunds, disputes, subscription pause/resume, and dunning are explicitly later sprints (4-5) per
  the workplan — this pass only makes a payment "land in Postgres from webhooks alone," per Sprint
  3's own done-when bar, nothing past that.
- `payments.stripePaymentIntentId`'s uniqueness can't dedupe an `invoice.paid` retry that lands
  with a null id (only happens if `invoice.payments` isn't present on that delivery) — accepted
  as rare given the webhook-level `processedAt` dedupe already covers the common case; flagged in
  code, not fixed further.

### Storefront checkout buttons wired up (2026-09-27, same branch, later same day)

Manvendra asked for the "coming soon" checkout buttons to actually work, explicitly overriding the
"that's Pari's task" scoping note above — done in this session rather than left for her workplan.

**New**: `lib/checkout.ts` (`createCheckoutSessionApi`, the frontend fetch wrapper following the
`lib/offers.ts`/`lib/payouts.ts` pattern over `apiFetch`), `components/CheckoutDialog.tsx` — the one
screen between an offer card and Stripe-hosted Checkout, collecting just the client's email (the
only thing `POST /api/checkout` needs from the browser; Stripe's own page collects card details).
`components/PublicOfferList.tsx` now holds which offer is selected and renders the dialog instead of
a toast placeholder. Added a `close` icon to `lib/icons.tsx` (didn't exist before — every other
dismiss action in this app is a full page/link, not an in-page dialog).

**On success this does a real `window.location.href` navigation to Stripe's `checkoutUrl`** — an
external redirect, not a client-side route change, so none of the Router-Cache-staleness class of
bugs documented earlier in this file applies here (the whole app is torn down regardless). New CSS
in `app/styles/public.css` (`.ins-checkout-overlay`/`.ins-checkout-box`/`.ins-checkout-close`)
follows the same fixed-overlay-plus-frosted-panel pattern as the command palette (`.ins-cmdk`).

**Verified in a real dev server** (Playwright): built a temporary, unlinked preview page rendering
`PublicOfferList` with hardcoded offer data (deleted before finishing — the real public storefront
page's data loads server-side via `loadPublicProfile`, which a browser-level Playwright route mock
can't intercept, unlike the client-side `POST /api/checkout` call this pass actually needed to
verify). Confirmed: clicking an offer opens the dialog; submitting with no email shows the inline
field error without calling the API; a valid email posts `{offerId, clientEmail}` to
`/api/checkout` and navigates to the mocked `checkoutUrl`; Escape closes the dialog. Screenshots
taken, not just asserted, same standard as the rest of this file's UI verifications.

**Not done**: no component-rendering test for `CheckoutDialog`/`PublicOfferList` — consistent with
every other component in this repo (`SignupForm`, `LoginForm`, `TopBar`, `Sidebar`, ...), since
component-rendering tests still need jsdom + React Testing Library, a setup this repo hasn't added
(see "Testing (Jest)" above). `lib/checkout.ts` (the testable, non-component logic) has its own
test file, per the standing rule.

### Pushed to `main` and deployed (2026-09-27)

Manvendra asked directly ("push the current version to main and deploy"). `feat/commerce-checkout`
was a clean fast-forward of `main` (no divergence — same pattern noted in the Sprint-1 process-audit
entry above, `main` is the de facto merge target for Commerce branches), pushed straight, no PR.
Push auto-triggered a Vercel production build (commit `c9b9d48`); confirmed `READY` and aliased to
`instar-fit.vercel.app` via `get_deployment`. No new env vars needed this time (no schema change,
no new required config), so — unlike every earlier deploy in this file — there was no
build-finished-before-env-vars-existed redeploy needed.

**Still not live in the sense that matters**: `STRIPE_WEBHOOK_SECRET` isn't set in Vercel and no
webhook endpoint is registered in Stripe's Dashboard (flagged when Sprint 3 was built, unchanged
by this deploy) — so a real checkout completed against production today would create the Stripe
Checkout Session fine, but nothing would write the `clients`/`subscriptions`/`payments` rows
afterward, since the webhook that does that never reaches this app. Registering that endpoint +
secret is the next thing standing between "the routes exist" and "a payment actually lands in
Postgres," which is Sprint 3's own done-when bar.

### Webhook endpoint registered — Sprint 3 fully closed out (2026-09-27)

Manvendra asked to close this off. This session's own sandbox still can't reach `api.stripe.com`
directly (confirmed: a direct request to it gets a 403 from this container's egress proxy, same
kind of organization-policy block as `*.vercel.app` elsewhere in this file) and there's no Stripe
MCP connector available here, so registering the endpoint itself had to be a manual Dashboard step
— unlike every other piece of this sprint, this one genuinely couldn't be done from inside the
session.

Manvendra registered `https://instar-fit.vercel.app/api/webhooks/stripe` in the **Instar Sandbox**
Stripe environment (matching where `STRIPE_SECRET_KEY` already points — same environment-pairing
rule as the Connect incident above: whichever Stripe environment the keys belong to is the one
that needs the matching config), subscribed to `checkout.session.completed`,
`payment_intent.succeeded`, and `invoice.paid`, and pasted the resulting signing secret. Set as
`STRIPE_WEBHOOK_SECRET` in Vercel (production+preview+development) via the API, then redeployed the
current production commit (`59a2ecc`) to pick it up — same bake-in-at-build-time gotcha as every
other secret in this file.

**Sprint 3's own "done when" bar** ("a card payment for each offer type lands in Postgres from
webhooks alone") **is now actually reachable in production**, not just in tests — assuming
migrations 0000-0004 are applied (confirmed earlier) and a coach has completed Stripe Connect
onboarding (also confirmed working, per the live-Stripe incident above). Not yet independently
verified with a real test-mode payment end to end — this session still can't exercise Stripe or
Postgres directly; that verification needs someone with real network access to actually run a
checkout and check the `payments` table.

### Checkout dialog fixed, fee disclosure + success/cancelled page added (2026-09-27)

The user flagged the checkout dialog as "too transparent." Root cause was two compounding things,
not one: `.ins-panel`'s own background is only a ~3-4% tint meant to sit over the near-solid page
background with a `backdrop-filter` blur doing the rest of the obscuring — fine for an ordinary
in-page panel, but this dialog stacks on top of *other* panels (the offer card behind it), and
that blur isn't reliably rendered everywhere (a headless-browser screenshot showed it flat,
un-blurred). Separately, the dialog carried two conflicting `animation` declarations on the same
element — its own 0.25s entrance plus the unrelated `.ins-in` class's 0.7s one (meant for staggered
page-load reveals, not an on-demand modal) — both fading in from `opacity: 0`, so whichever won the
cascade left it visibly translucent for up to 700ms. Fixed: `.ins-checkout-box`'s background is now
fully opaque (`var(--bg)`, matching the page exactly, with the border/shadow doing the "raised
surface" work instead of transparency), and `.ins-in` was dropped from the element so only the fast
entrance remains.

While in there, the user asked to close the two remaining gaps in Pari's own Sprint 3 spec that the
checkout backend/dialog pass hadn't covered — the fee breakdown shown *before* paying, and a
success/cancelled page after Stripe redirects back (both explicitly called out in
`Workplan-Pari.md`'s Sprint 3, which the user re-shared this session).

**Fee breakdown**: `lib/checkout.ts` gained `fetchCheckoutQuote(offerId)`, calling the
already-existing `GET /api/checkout/quote` (built during the checkout-backend pass, just never
wired into any UI). `CheckoutDialog` fetches it on mount and renders a base/service-fee/total
breakdown above the email field (subscription offers get a "Total/mo" suffix) — never computed
client-side, per the standing "never compute fees in the browser" rule. A failed fetch falls back
to a plain "$X + a service fee, shown at checkout" line rather than blocking the dialog or
fabricating a number; the checkout button still works either way, since Stripe's own Checkout page
shows the authoritative total regardless of what this preview says.

**Success/cancelled page**: `createCheckoutSession`'s `successUrl`/`cancelUrl` already defaulted to
`/<handle>?checkout=success` / `?checkout=cancelled`, but nothing read that query param.
`app/(public)/[handle]/page.tsx` now reads `searchParams`, and `PublicStorefrontView` renders the
new `components/CheckoutOutcomeBanner.tsx` above the profile — a checkmark card ("Payment
received... check your email for a receipt") or a neutral one ("Checkout cancelled, you weren't
charged"). It's a client component only so its dismiss button can clear the query param
(`router.replace(pathname)`) — otherwise a refresh would keep re-showing it forever. Not wired into
`OwnerPreview`: an unpublished page can't actually receive a real checkout redirect, since
`POST /api/checkout` requires `coach.published`.

No new receipt-details plumbing (a `GET /api/checkout/session/:id` to show the exact amount/email
on the success page) — the workplan's "receipt email copy" is Stripe's own automatic receipt
email, not something this page needs to duplicate; the on-site copy just tells the client to check
their inbox. Revisit if a richer on-site confirmation turns out to matter more than judged here.

Verified in a real dev server (Playwright, same temporary-unlinked-preview-page technique as the
earlier checkout-dialog pass, deleted before finishing): the dialog settling fully opaque well
within its now-0.25s entrance, one-time and subscription fee breakdowns, the quote-fetch-failure
fallback, both outcome banners, and the dismiss button actually clearing the query param via a real
navigation. Screenshots taken, not just asserted. `tsc`/`eslint`/`npm test` (39 suites, 343
tests)/`npm run build` all clean.

**Still not done**: no client-facing login yet (Sprint 4 of `Workplan-Pari.md` — magic-link
"My subscription" self-serve, pause flow, dunning) — deliberately sequenced after these two Sprint 3
gaps, since Sprint 4's own subscription-management screens need a completed checkout to have
anything real to manage. Recommended as the next piece of work; not started.

### Three UX bugs fixed: autofill styling, missing loading states (2026-09-27)

Manvendra asked three things in one message: (1) whether test-mode checkouts send receipt emails
at all, (2) autofilled fields (e.g. email/password on login) showing a stark white background that
breaks dark mode, and (3) several pages rendering blank for a moment while their first data fetch
is in flight, reading as "the app crashed" rather than "loading."

**(1) is not a code question** — answered directly, not fixed: whether Stripe sends a receipt for
a test-mode payment depends entirely on the "Email customers about successful payments" toggle
under the Stripe Dashboard's Customer emails settings, for whichever environment the coach is
testing in (the Instar Sandbox, per the webhook/keys pairing noted above). This app never sends its
own receipt email — see the checkout-outcome-page entry above ("the workplan's 'receipt email copy'
is Stripe's own automatic receipt email, not something this page needs to duplicate"). Nothing to
check or flip from inside this session (Dashboard-only setting, and this sandbox has no reliable
path to Stripe's API to read it back either).

**(2) Autofill styling**: Chrome/Safari paint an autofilled `<input>` with their own opaque
background (ignoring the page's dark theme) via `-webkit-autofill` UA styles that a plain
`background` override can't beat. Fixed in `app/styles/auth.css` with the standard workaround —
a `box-shadow: 0 0 0 1000px var(--chip) inset` (fills the same area a background-color would,
since a real background-color loses to the UA style) plus `-webkit-text-fill-color` for the text
color and a long `transition-delay` to stop the yellow/white flash Chrome animates in the instant
autofill fires. Applied once to the shared `.ins-input input` selector — every text/password/email
field in the app (login, signup, offer builder, storefront creator, the checkout dialog, ...) uses
this same markup, so this one fix covers all of them. Not verified in a real browser's actual
autofill (this sandbox's headless Chromium has no saved credentials to trigger genuine autofill,
and scripting `.value` doesn't engage the `:-webkit-autofill` pseudo-class) — this is the
well-established, ubiquitous fix for this exact symptom, but worth a real visual check on a device
with saved credentials.

**(3) Missing loading states**: audited every `if (!hydrated) return null` / equivalent blank
early-return gating on `AppStateProvider`'s first-load flag, found five real spots where a whole
page (including its otherwise-static title) went blank for the ~second or so those fetches take:
`OffersList`, `PayoutsPage`, `StorefrontCreator`, `OfferEditor` (edit mode's separate `!loaded`
gate, waiting on the offers list to hydrate before it can find the one being edited), and
`OwnerPreview` (rendered an empty `<main aria-busy>` — technically not `null`, but visually
identical to one). Added a shared `components/LoadingSection.tsx` (spinner + label, `.ins-panel`)
and a shared `.ins-spinner` class in `components.css` — deduped from what was a payouts-page-only
`.ins-po-spinner`/`@keyframes ins-spin` pair in `payouts.css` (`PayoutsReturn.tsx` already had a
working spinner for its "Checking with Stripe…" screen; generalized rather than left
payouts-specific). Each of the five spots now keeps its hero/title rendering immediately
(unconditionally, extracted into a small local hero helper per file where the hero previously lived
inside the same early-return-guarded block) and swaps only the data-dependent body for
`<LoadingSection label="..." />` while loading.

**Incidental fix found while touching `StorefrontCreator`'s hero**: its title/description ternary
checked `showForm && !storefront`, but by the point that JSX runs, `storefront` is always non-null
(an earlier guard already returns early if it's null) — so the condition was dead code, always
false, meaning a first-time coach never actually saw the "Create your storefront" heading/copy,
only ever "Your storefront." Fixed to check `!storefront.completed` (the field the condition was
clearly meant to test, matching `showForm`'s own definition just above it).

Verified in a real dev server (Playwright, hand-crafted signed session cookie — same technique as
prior sessions — with `/api/offers`, `/api/coach/profile`, `/api/coach/onboarding-status`, and
`/api/storefront` all mocked with an artificial 2s delay so the loading state has time to render):
screenshots confirm all five spots now show their title immediately plus a spinner and label
instead of a blank gap. `tsc`/`eslint`/`npm test` (39 suites, 343 tests)/`npm run build` all clean.

## Sprint 4 (partial): client magic-link login (2026-09-27)

The offer-checkout 500 the user hit turned out to be a data problem, not a code bug: that specific
offer's `stripeProductId`/`stripePriceId` were created before the switch to the Instar Sandbox
Stripe environment, so its Stripe objects simply don't exist under the key now configured — same
class of orphaned-cross-environment issue already documented for offer edits. Fix was
delete-and-recreate the offer (a new one calls `createStripeProductAndPrice` fresh, under whatever
key is current); no code change, flagged so any other pre-rotation offer gets the same treatment
before someone tries to buy it.

Asked what's next, recommended Sprint 4 (`Workplan-Pari.md`) — client self-serve billing — since
it's the first thing needing real subscriptions to manage, which now exist. Its first bullet names
its mechanism explicitly: "Client 'My subscription' page (**magic-link login**)". Talked through
two open questions before building: whether a client with purchases from multiple coaches should
see one unified dashboard (not mentioned in the workplan — **explicitly decided against it**, kept
to today's per-coach `clients` model) and how the link actually reaches a client "anytime" (a
request-a-fresh-link-each-time flow, not a single one-time post-checkout email). See `Decisions.md`
for the full reasoning on both, plus why magic-link beats a "normal" password login for clients
(a password login still needs a magic-link-shaped bootstrap step to prove email ownership first, so
it adds a second auth mechanism on top rather than replacing one).

**New — schema**: `client_login_tokens` (migration `0005_square_bastion.sql` — same
unconfirmed/unapplied situation as every migration since 0000; handed off the same way, this
sandbox still has no Postgres access). Stores `sha256(token)`, never the raw token; 15-minute
expiry; `usedAt` enforced single-use via an atomic `UPDATE ... WHERE usedAt IS NULL RETURNING`.

**New — auth**: `lib/auth/clientToken.ts` (generate/hash), `lib/auth/clientSession.ts` (a second,
separate JWT session — `instar_client_session` cookie, its own `CLIENT_SESSION_JWT_SECRET`,
deliberately not shared with the coach session's `AUTH_JWT_SECRET` — coaches and clients are
different trust domains), `lib/auth/require-client.ts` (mirrors `require-coach.ts`).

**New — email**: this app had no email-sending capability at all before this. Manvendra chose
Resend when asked directly. `lib/email/resend.ts` (lazy client, same gotcha as `getStripe()`/
`getDb()` — must never construct at module scope), `lib/email/send.ts` (`sendMagicLinkEmail`, the
one function that sends this one email). New env vars: `RESEND_API_KEY`, `EMAIL_FROM` (defaults to
Resend's sandbox sender, which only delivers to the account owner until a domain is verified),
`CLIENT_SESSION_JWT_SECRET`. None of these are set in Vercel yet, nor is `RESEND_API_KEY` in this
sandbox's `.env.local` — no real email has been sent by this pass, only unit-tested with `getResend`
mocked (this sandbox also still can't reach most external APIs directly to test live anyway).

**New — routes**: `POST /api/client/login/request` (always returns the same generic success
message whether or not the email matched an account — no enumeration of who's bought from a given
coach), `GET /api/client/login/verify?token=` (what the emailed link points to — verifies, marks
the token used, sets the session cookie, redirects to `/<handle>/account`; a GET, not a POST, since
it's meant to be opened directly from an email client), `POST /api/client/logout`,
`GET /api/client/me`.

**New — frontend**: `/<handle>/account/login` (server page + `components/ClientLoginForm.tsx` —
email in, "check your email" confirmation out, mirrors `SignupForm`'s done-card pattern) and
`/<handle>/account` (server page, gates on the client session **and** that its `coachHandle`
matches the URL's handle — a session valid for a different coach relationship redirects to login,
not to someone else's account; `components/ClientAccountView.tsx` for now just proves the loop
works — "logged in as X, working with Y" + a logout button, not yet the actual subscription
details/card update/cancel/pause, which is the rest of Sprint 4).

**Deliberate exception to "pages fetch through an API route"**: both new pages query `getDb()`
directly rather than calling an API route, because `GET /api/coach/[handle]` (the existing public
endpoint) is gated by `coaches.published`, and a client who bought before their coach unpublished
still needs to log in — reusing that endpoint would incorrectly lock them out. Simpler than adding
a second, near-identical coach-lookup endpoint.

**Verified**: `tsc`/`eslint`/`npm test` (49 suites, 388 tests)/`npm run build` (all six lazy-client
env vars unset) all clean. Playwright, real dev server: the login-request form's submit → "check
your email" confirmation (mocked API response), and the account page's redirect guard — both with
no session cookie, and with a hand-crafted valid client-session cookie for a *different* coach's
handle than the URL — both correctly bounce to that coach's own login page rather than leaking
access or erroring. Screenshots taken. Could not verify: an actual magic-link email being sent and
clicked (needs `RESEND_API_KEY` + a database), or the account page's real data-loaded path (needs
Postgres) — same standing sandbox limitations as everywhere else in this file.

**Not done — the rest of Sprint 4**: subscription details (plan, next charge), update card, cancel,
the pause flow (vacation/injury/other + resume date), failed-payment screens + dunning nudge
emails, and the coach-side view of active/paused/past-due clients. This pass is the auth mechanism
only, per what was explicitly asked for.

### Confirmed working live in production (2026-09-27)

`RESEND_API_KEY` and `CLIENT_SESSION_JWT_SECRET` set in Vercel (redeployed to pick them up),
migration `0005` applied, and a test client row inserted by hand in Supabase (coach's own email,
since Resend's sandbox sender only delivers to the account's own address until a domain is
verified). Manvendra then actually ran the flow on the live site and confirmed it end to end — the
first feature in this entire file verified this way, rather than only unit-tested or checked with
mocks: requested a link at `/manvendra-pant/account/login`, received the real email via Resend,
clicked it, and landed on `/manvendra-pant/account` correctly showing the client's name and the
coach's display name pulled from Postgres.

One real limitation surfaced along the way, worth remembering: **the sandbox sender's
"testing emails only go to your own address" restriction is a hard 403 from Resend's API**, not a
soft one — and because `POST /api/client/login/request` deliberately always returns the same
generic success message (so it can't be used to enumerate which emails have an account), that
403 gets swallowed silently from the client's point of view. A real client whose email isn't the
Resend account's own registered address will see "check your email" and then nothing ever arrives,
with no visible error anywhere. **Verifying a sending domain in Resend is a hard requirement before
any client other than the account owner can use this flow** — not an optional polish step. Not done
yet; Manvendra hasn't picked a sending domain.

## Sprint 4 completed for both workplans (2026-09-27) — recurring billing, dunning, pause, client self-serve

Manvendra re-shared both `Workplan-Manvendra.md` and `Workplan-Pari.md` in full and asked for an
honest check of what Sprint 4 actually had done — the answer was "only the magic-link login above,
nothing else" — then asked to complete Sprint 4 for **both** workplans in one pass. See
`Decisions.md`'s "Sprint 4 completed for both workplans" entry for the full design rationale (the
Stripe `pause_collection`-vs-`status` quirk in particular — read that before touching any of this
code again). No schema change was needed: Sprint 1's `subscriptions` table already had everything
(`status` enum including `paused`/`past_due`/`canceled`, `pauseResumesAt`, `pauseReason`).

**`lib/commerce/subscriptions.ts`** (new) — the shared, DB-aware module both the webhook handler
and the client-facing routes use: `mapSubscriptionStatus` (moved here from `webhookHandlers.ts`,
now exported so it isn't duplicated), `subscriptionSyncFields` (the one place a Stripe Subscription
object becomes our own row's fields — see the pause_collection quirk above), `toClientSubscriptionSummary`/
`toCoachClientSummary` (row → API shape mappers), `findOwnClientSubscription` (ownership-scoped
lookup, mirrors `findOwnOffer`), and `validatePauseInput` (reason must be vacation/injury/other,
resume date must be a real future yyyy-mm-dd within a year).

**Webhook handlers** (`lib/commerce/webhookHandlers.ts`) — `dispatchWebhookEvent` gained an `origin`
parameter (needed to build the dunning email's login link; the route now passes
`new URL(req.url).origin`) and five new routed event types:
- `invoice.payment_failed` / `invoice.payment_action_required` -> `handleInvoicePaymentFailed`/
  `handleInvoicePaymentActionRequired`, both thin wrappers around a shared `sendDunningNudge` that
  mints a fresh login token (reusing `client_login_tokens`, `generateLoginToken`/`hashLoginToken`
  from `lib/auth/clientToken.ts`, whose `LOGIN_TOKEN_TTL_MS` is now a named export instead of a
  private constant duplicated in the login-request route) and calls the new `sendDunningEmail`
  (`lib/email/send.ts`). Neither handler writes `subscriptions.status` itself — see Decisions.md for
  why. Wrapped in try/catch so an email-provider hiccup never fails the webhook delivery.
- `customer.subscription.updated`/`.deleted`/`.paused`/`.resumed` -> all four routed to one shared
  `handleSubscriptionSynced`, which now just calls `subscriptionSyncFields` and writes the result.

**Client-facing routes** (all under `requireClientSession()`, mirroring the coach-side auth
pattern):
- `GET /api/client/subscriptions` — the "My subscription" page's data, one row per subscription.
- `POST /api/client/subscriptions/[id]/pause` — body `{ reason, resumeDate }`; calls
  `stripe.subscriptions.update(id, { pause_collection: { behavior: 'void', resumes_at } })`, then
  syncs the DB row from the response via `subscriptionSyncFields` (passing the request's `reason`
  as the "existing" pause reason, since it's always freshly set right after this call).
- `POST /api/client/subscriptions/[id]/resume` — manual early resume (Pari's workplan literally
  says "resume" as a self-serve action separate from waiting for the scheduled date). Clears
  `pause_collection` with the empty-string `Emptyable` convention Stripe's SDK types define.
- `POST /api/client/subscriptions/[id]/cancel` — immediate cancel via `stripe.subscriptions.cancel`
  (see Decisions.md for why immediate, not at-period-end).
- `POST /api/client/portal` — creates a Stripe Customer Portal session for the signed-in client's
  own `stripeCustomerId`, return URL `/<coachHandle>/account`. **Needs a Customer Portal
  Configuration in the Stripe Dashboard (Settings -> Billing -> Customer portal) before this
  succeeds in production** — a Dashboard-only step, not something any future session can do or
  verify from code; flag it to whoever owns the Stripe account if this 500s in practice.

**Coach-facing route + page**: `GET /api/coach/clients` (one row per subscription, joined
`subscriptions` + `clients` + `offers`, scoped to `session.coachId`) backs a new
`lib/data.ts` business-space tile (`id: 'subscribers'`, title "Clients" — `subscribers` to avoid
colliding with the existing top-level `clients` space id) and a real `/business/clients` route
(`components/ClientsPage.tsx`, own fetch-on-mount + loading/error/empty states, not wired into the
shared `AppStateProvider` since nothing else needs this data — a deliberate "don't widen an
already-complex context for a single page" call). `components/Sidebar.tsx` gained a `subscribers`
special case (real `<Link>` to `/business/clients`, `roster` icon) alongside the existing
payouts/offers/storefront ones.

**Client account page rewritten** (`components/ClientAccountView.tsx`) — replaces the "proves the
loop works, nothing else built yet" stub from the magic-link-login pass with the real thing: one
card per subscription (plan, price, status chip), a past-due banner ("your last payment didn't go
through... Update your card"), "Update card" (redirects to the Customer Portal), "Pause" (inline
form: reason select + date input, same field-error pattern as every other form in this app),
"Resume now" while paused, and "Cancel" behind the same click-to-reveal inline confirm pattern
`OfferEditor`'s delete button already uses (`.ins-offer-confirm`/`.ins-btn-bad`, reused verbatim
rather than inventing a second confirm UI). New frontend module `lib/clientSubscriptions.ts`
(fetch wrappers + `formatSubscriptionPrice`), new styles in `app/styles/clients.css` (shared with
the coach-side clients table above — both are "client billing" concerns).

**Verified**: `tsc --noEmit`, `eslint .`, `npm test` (58 suites, 460 tests), `npm run build` (with
`DATABASE_URL`/`AUTH_JWT_SECRET`/`STRIPE_SECRET_KEY` unset) all clean. Playwright, real dev server,
same "temporary unlinked preview page + mocked fetch routes" technique as the checkout-dialog pass
(built at `app/(public)/preview-account-test/`, deleted before finishing — **note for a future
session**: a folder name starting with `_` is a Next.js "private folder" excluded from routing
entirely, which silently fell through to the `[handle]` dynamic route on the first attempt; use a
plain segment name for any future throwaway preview route, not `__anything`). Confirmed: every
subscription-card state (active, past_due with banner, paused, canceled), the pause form's
inline validation and full submit-to-paused flow, resume, the cancel confirm-then-cancel flow,
update-card's redirect, and the loading/error/empty states — all screenshotted. Also confirmed the
coach-side `/business/clients` table (one row per subscription, correct status chips/dates) and the
Sidebar's new "Clients" entry (icon, active-state highlight) with a hand-crafted signed coach
session cookie, same technique as every earlier coach-dashboard verification in this file.

**Not done / deliberately out of scope**:
- No live-Stripe or live-DB verification (same standing gap as every pass in this file — this
  sandbox reaches neither Postgres nor Stripe's API directly).
- Stripe Smart Retries and the Customer Portal Configuration are both Dashboard-only steps this
  session cannot perform or confirm — flag to Manvendra before relying on either in production.
- No component-rendering tests for `ClientAccountView`/`ClientsPage`/the inline `PauseForm`/
  `SubscriptionCard` — consistent with every other component in this repo (see "Testing (Jest)"
  above); the underlying `lib/` modules (`subscriptions.ts`, `clientSubscriptions.ts`,
  `coachClients.ts`) all have full test coverage.
- Reconciling an offer's orphaned Stripe product/price across a `STRIPE_SECRET_KEY` rotation
  (flagged in the earlier "offer edit" bug fix) remains unhandled — unrelated to this pass, not
  reintroduced by it.

### Dropdown styling fix, missing webhook event subscriptions, and a suspected one-time-vs-subscription gap (2026-09-27)

Manvendra flagged the pause form's reason `<select>` as "ugly, doesn't match the theme" — a real
bug: `.ins-input select` had no rule at all, so the control kept the browser's own opaque, unthemed
chrome. Fixed in `app/styles/auth.css` (`appearance: none`, transparent background, themed text,
the existing `chev` icon rotated 90° as a stand-in for the native arrow — the popup listbox itself
still uses OS/browser chrome on Chrome/Safari regardless, nothing in CSS reaches inside that part).
**Gotcha hit while fixing it**: passing `className="ins-select-chev"` to `<Icon>` replaced its
default `"ins-i"` class instead of adding to it, losing `.ins-i`'s width/height/stroke rules
entirely — the icon rendered as a giant unsized black triangle covering the whole field. Every
other icon-with-modifier call site in this repo does `className="ins-i <modifier>"` for exactly
this reason (e.g. `<Icon name="check" className="ins-i sm" />` in `PayoutsPage.tsx`) — `Icon`'s
`className` prop replaces, it doesn't merge. Pushed and deployed same as every other fix in this
file.

Manvendra then reported two things while live-testing the rest of Sprint 4:

**1. Updating his name via the Stripe Customer Portal didn't show up anywhere in the app.** Root
cause: nothing synced `customer.updated` back into our `clients` table — the Portal only ever
talks to Stripe directly, never to our API, so without a webhook handler for it, a name/email
change there was simply invisible to us. Fixed: `handleCustomerUpdated` (`lib/commerce/
webhookHandlers.ts`) finds the client by `stripeCustomerId` and syncs `name`/`email` when either
actually changed. **Requires `customer.updated` to be added to the Stripe Dashboard webhook
endpoint's subscribed events** (Developers → Webhooks → the existing `.../api/webhooks/stripe`
endpoint → Add events) — same as the six event types below, still not confirmed added as of this
writing.

**Also surfaced, and worth calling out clearly**: when Sprint 4's webhook handlers were built, the
existing Stripe webhook endpoint (registered back in Sprint 3 for `checkout.session.completed`,
`payment_intent.succeeded`, `invoice.paid` only) was never actually updated in the Stripe Dashboard
to subscribe to the new event types the new handlers listen for. The **code** for
`customer.subscription.updated/deleted/paused/resumed`, `invoice.payment_failed`,
`invoice.payment_action_required`, and now `customer.updated` all exist and are deployed — but
Stripe has no reason to ever send us those events until the endpoint's subscription list is
updated to include them. This was flagged too narrowly the first time (only the Customer Portal
Configuration and Smart Retries were called out as Dashboard-only gaps) — this is a third, separate
Dashboard step of the same kind: **add these seven event types to the existing webhook endpoint**:
`customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`,
`customer.subscription.resumed`, `invoice.payment_failed`, `invoice.payment_action_required`,
`customer.updated`. Until this is done, anything a client changes via the Stripe Customer Portal
(cancel, plan switch, card, name/email) — or a subscription lifecycle change Stripe makes on its
own (a renewal failing, a scheduled pause auto-resuming) — will silently never reach this app,
regardless of how correct the handler code is.

**2. "Bought another offer, the new subscription doesn't show up anywhere — not on my account
page, not on the coach's Clients page — only the old, already-canceled one does."** Not yet
root-caused with certainty (this session still can't read production logs, the DB, or Stripe's
event history directly — same standing limitation as everywhere else in this file). The leading
hypothesis, from reading the code rather than the data: **`GET /api/client/subscriptions` and
`GET /api/coach/clients` both only ever query the `subscriptions` table** — a one-time (`one_time`
or `session` type) offer purchase is recorded in `payments` instead (via `payment_intent.succeeded`,
which has worked since Sprint 3), and neither of these two new Sprint-4 surfaces was built to show
`payments` rows at all. If the "new offer" Manvendra tested was a one-time program or single
session rather than another subscription, this would be exactly the observed symptom — by design
scope, not a bug: Sprint 4 was framed as recurring-billing self-serve, and one-time purchases were
never brought into either of these two screens. Asked Manvendra to confirm the new offer's type; if
it was actually another `subscription`-type offer, the next things to check (this session cannot
check them itself) are: whether `checkout.session.completed` actually fired for that second
purchase (Stripe Dashboard → Developers → Webhooks → the endpoint → Events, look for that specific
delivery and its response code), and whether it 200'd or errored. Not fixed yet — needs that answer
before writing any code, since guessing at a fix here risks patching the wrong thing.

### One-time purchases surfaced on both the client and coach pages (2026-09-27)

Confirmed: the new offer was a program (`one_time` type), not another subscription — so the
hypothesis above was right, and it wasn't a bug so much as a real product gap: a coach should be
able to see every client who's ever paid them, not just the ones on a recurring plan. Manvendra
asked for both sides fixed rather than just documenting the scope limit.

**Shared types** (`lib/commerce/types.ts`): `ClientPurchaseSummary` (added to
`ClientSubscriptionsResponse.purchases`) and `CoachPurchaseSummary` (added to
`CoachClientsResponse.purchases`) — both intentionally minimal (offer name, amount, currency,
purchase date, an id for a stable React key) since a one-time purchase has no ongoing state:
no status, no pause/cancel, no next-charge date, because nothing about it recurs.

**New `lib/commerce/purchases.ts`**: `toClientPurchaseSummary`/`toCoachPurchaseSummary`, the row →
API-shape mappers, mirroring `lib/commerce/subscriptions.ts`'s equivalents.

**Both `GET /api/client/subscriptions` and `GET /api/coach/clients`** now run a second query in
parallel (`Promise.all`) against `payments`, filtered to `subscriptionId IS NULL` (a subscription's
own billing-cycle payments — written by `handleInvoicePaid` — always have one set; only a one-time
`payment_intent.succeeded` payment doesn't) and `status = 'succeeded'`. No new migration — every
column already existed; this was purely a query the two routes never ran.

**Frontend**: `ClientAccountView` gained a `PurchaseCard` (offer name, amount, purchase date — no
actions) rendered below any subscription cards; the "nothing here yet" empty state now only shows
when both `subscriptions` and `purchases` are empty. `ClientsPage` gained a second "Programs &
sessions" table below the existing subscriptions table, same idea. Both `lib/coachClients.ts` and
`lib/clientSubscriptions.ts`'s fetch wrappers were extended to return the new `purchases` array
from the same response (no new endpoint) rather than adding a second fetch to manage.

**Verified**: `tsc`, `eslint`, `npm test` (59 suites, 469 tests), `npm run build` all clean.
Playwright, real dev server (same temporary-preview-page technique as every prior UI pass in this
file, deleted before finishing): confirmed a canceled subscription plus a program purchase render
together, a purchase-only client (no subscriptions at all) renders correctly with no stray empty
state, and the coach's two-table view (one subscription, one program purchase, different clients)
renders both sections independently.
