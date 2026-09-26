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
(`manvendra-s-projects1` / `team_rTqJzCsTpprfKa0TvMCruWJO`), linked to this GitHub repo, deploying
`updated-obsidian-plus` to production. Public, no login wall (`ssoProtection` explicitly disabled):
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

**Not done / needs the user**: no Postgres database is provisioned yet (`DATABASE_URL` unset — the
build tolerates this by design; `db:migrate`/`db:seed` will fail loudly until it's set), and no
Stripe test-mode keys are configured. Both are needed before Sprint 1's "done when" bar (Pari can
hit mocked routes; webhooks log in test mode) is actually met, not just compiles.

### Still open / next up

- Pari's Sprint 1 (storefront skeleton at `/[coachHandle]`) hasn't started in this repo yet.
- ORM choice (Drizzle, not Prisma) was an engineering call made without asking — revisit if there's
  a reason to prefer Prisma.
- Database provider (Vercel Postgres vs Neon vs Supabase) not chosen yet.

### Working conventions to carry into any Commerce code

- Money is always integer cents + ISO currency — never floats.
- Webhook handlers are idempotent (dedupe on Stripe event ID, store in `webhook_events`).
- Never compute prices or fees in the browser — `lib/commerce/money.ts` (server-only) is the only
  source; the UI only displays what an API returns.
- `/lib/commerce/types.ts` is the one contract; flag any change to it rather than editing quietly.
- Stripe test mode + test clocks only until the Sprint 6 "hardening & launch" milestone.
- Branch naming: `feat/commerce-<short-name>` (Manvendra), `feat/storefront-<short-name>` (Pari).
- Any Stripe client / DB client constructed at module scope must be lazy (see gotcha above).
