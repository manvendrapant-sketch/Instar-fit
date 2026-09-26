@AGENTS.md

# Project memory — Instar

Read this before picking up any Instar work in this repo. It records what exists, why, and what's
still undecided, so a session can pick up cold instead of re-deriving context.

## What this repo is

`manvendrapant-sketch/Instar-fit` — currently holds a **frontend-only prototype** of the Instar
coach dashboard (the "Today / Clients / Grow / Business" app), built in Next.js 16 (App Router).
It is a faithful UI replication, not a product with a backend: all data is static/in-memory
(`lib/data.ts`), there is no auth, no database, no Stripe. Treat it as the design/interaction
reference for that dashboard, not as the codebase the new Commerce work necessarily lands in
(see "Open question" below).

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
**Bitbucket**, not this GitHub repo. **Open question, unresolved**: whether the Commerce build
(schema, `/lib/commerce`, `/app/api`, storefront routes) should land in *this* repo
(`Instar-fit` on GitHub) or a separate Bitbucket repo Claude does not currently have access to.
Don't assume either way — ask, or wait for a repo to be attached, before writing Commerce code.

### First tasks decided when this was discussed

Not a sprint-1 build task first — a short **decisions meeting** blocks everything else. Settle,
with Pari (and Sanchit per the workplan):
1. Stripe Connect account type (workplan recommends Express for fastest KYC/onboarding)
2. Charge type — destination vs direct (decides who carries dispute/chargeback liability and
   whose name is on the client's card statement)
3. How the ~3% processing fee is shown to the client — true surcharge vs a flat "service fee"
   line (card-network rules and some US state laws restrict surcharging; Pari needs this for
   checkout copy)
4. Platform take rate (`application_fee_amount`/`application_fee_percent`, if any)
5. Confirm the money-in-integer-cents convention (not really a decision — just adopt it, no floats
   anywhere money is touched)

Immediately after (same day/next), in parallel:
- **Manvendra**: draft the Postgres schema/migrations and publish the shared contract
  `/lib/commerce/types.ts` + API route shapes. This is the critical-path task — Pari's Sprint 1
  and every sprint after builds against it; her own workplan lists "agree the API contract + types
  with Manvendra (Day 2–3)" as her first Week 1 input. Stripe client wrapper, webhook endpoint
  skeleton (`/api/webhooks/stripe`) and a seed script follow right behind so Pari has real-shaped
  (if fake) data.
- **Pari**: start Sprint 1's storefront skeleton against mock data — the public `/[coachHandle]`
  route, profile block, SEO/OG metadata — none of this needs the real contract yet. Wire it to
  Manvendra's actual types as soon as they land, and weigh in on decision #3 above since it drives
  her checkout copy.

### Working conventions to carry into any Commerce code

- Money is always integer cents + ISO currency — never floats.
- Webhook handlers are idempotent (dedupe on Stripe event ID, store in `webhook_events`).
- Never compute prices or fees in the browser — the server/`/lib/commerce` is the only source; the
  UI only displays what an API returns.
- `/lib/commerce/types.ts` is the one contract; flag any change to it rather than editing quietly.
- Stripe test mode + test clocks only until the Sprint 6 "hardening & launch" milestone.
- Branch naming: `feat/commerce-<short-name>` (Manvendra), `feat/storefront-<short-name>` (Pari).
