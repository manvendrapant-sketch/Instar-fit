# Decisions

A durable log of the calls made on the Commerce pillar, so the reasoning travels with the code
instead of living only in a chat or an Obsidian vault. Newest first. Add to this, don't rewrite it.

---

## 2026-09-26 — Fixed live signup/login 500s: TLS to Supabase, uncaught route errors

Reported by Manvendra directly, hours after the merge/deploy above. Full detail in `CLAUDE.md`'s
"Two real bugs found from that gap" — this entry is the "why" for the two calls made fixing it.

**`ssl: 'require'` is now unconditional, not branched on the connection string.** `postgres-js`
would silently accept an unencrypted connection to anything that allows one; the failure only
shows up against something that doesn't, like Supabase. Rejected: making it conditional on
detecting a Supabase host in `DATABASE_URL`, which would just recreate the exact bug this was for
the next provider swap. Any Postgres worth using accepts an SSL connection, so there's no real
downside to requiring it everywhere rather than special-casing one provider.

**Route handlers now catch and log DB errors instead of letting them surface as bare framework
500s.** The alternative — leaving it uncaught and relying on `get_runtime_logs` to diagnose it —
turned out to not even be available to this session (403, permissions, see `CLAUDE.md`). Even
where log access works, an uncaught 500 still ships a frontend that can't show the visitor
anything. Catching at the route boundary and returning the same `apiError` envelope as every other
failure path fixes both problems with one change, not two.

---

## 2026-09-26 — Commerce/auth merged to `main`, pushed straight (no PR)

Requested by Manvendra directly ("merge this into main and publish on vercel"). See `CLAUDE.md`'s
"Merged to `main` and deployed" section for the mechanics (env vars set, redeploy, what couldn't be
verified from the sandbox). This entry is the "why", not the "what".

**Pushed directly to `main`, no PR opened.** Not asked for, and this repo's own process audit
(same day, earlier) already found that PRs here get self-merged within seconds with zero review —
opening one here would have been a formality adding a paper trail, not actual review. If real PR
review starts happening (branch protection, Pari actually reviewing), revisit this for future
merges; it was the right call for this one given the audit findings, not a new standing exception
to "ask before opening a PR."

**Deployed with `DATABASE_URL` and `AUTH_JWT_SECRET` set, but without confirming migrations are
applied.** The alternative was to hold the deploy until someone confirmed the migrations, but
Manvendra's ask was unambiguous ("publish on vercel"), the build itself doesn't depend on the
schema existing (both are lazy reads, by design — see the gotcha earlier in this file), and a
broken signup because of a DB error is a far easier problem to diagnose and fix live than an
unpublished branch nobody can look at. Trade-off made explicit rather than silently deployed and
called done: `CLAUDE.md` flags this as the one thing to verify next, not buried as an assumption.

## 2026-09-26 — Jest added; tests now required for new functionality

Requested by Manvendra directly, and closes a gap this repo's own process audit flagged earlier
the same day (the workplan requires "tests for webhook handlers" on every PR; none existed). See
`CLAUDE.md`'s "Testing (Jest)" section for the setup and the two non-obvious config fixes it took
(the `@/*` alias needs an explicit `moduleNameMapper` entry for `jest.mock()` calls specifically;
`jose`, used by the session module, needed next/jest's default `transformIgnorePatterns` rewritten
in place since it only ever appends to that default rather than letting it be overridden).

**Test environment: `node`, not `jsdom`.** Every test written in this pass targets Route Handlers
and `lib/` modules — real server code, never the DOM — so `node` is the more accurate and much
faster fit than the `jsdom` default most Next.js Jest guides default to (those guides assume
component-rendering tests, which this pass doesn't include). Rejected: `jsdom` project-wide, which
would have cost real speed for something none of these tests need. React component tests
(`SignupForm`, `LoginForm`, `TopBar`, `Sidebar`) are consequently still uncovered — that would need
`jsdom` + React Testing Library added as a separate, deliberate setup, not assumed here.

**Policy, not a one-time cleanup**: new functionality — a route, a `lib/` module, a non-trivial
component — ships with a test file in the same change from now on. Stated directly by Manvendra,
recorded here so it isn't treated as optional or renegotiated per task.

---

## 2026-09-26 — Frontend wired to the login/signup APIs, handle dropped from signup

Requested by Manvendra: pull the `login-feature` frontend branch (Pari/Manvendra's sign-up/log-in
pages, built frontend-only pending a real backend) and make it work end to end against the APIs
below.

**Handle is no longer a signup input.** The frontend's signup form only ever asked for a name —
adding a handle field would have meant redesigning an already-built, approved form for a detail
(the storefront URL slug) a new coach has no reason to think about at signup. Instead the handle is
now derived server-side from `displayName` (slugify, disambiguate with `-2`, `-3`, ... on
collision — `lib/auth/handle.ts`). Rejected: asking for it up front (extra friction, no clear
benefit at signup time) and defaulting to an opaque id (bad for a public storefront URL). A coach
can rename their handle later once there's a settings page for it — not built yet.

**Session JWT gained `displayName`.** It was already carrying `coachId`/`email`/`handle`; adding
the display name too means the dashboard chrome (top bar, sidebar) can render the signed-in coach's
name without a DB round trip on every page load. None of these are secret, so this cost nothing.

**Route protection is `proxy.ts`, not a client-side check.** Next.js 16 renamed `middleware.ts` to
`proxy.ts` (functionally identical, see `AGENTS.md`) — a session cookie is verified there before any
of `/`, `/clients`, `/grow`, `/business` render, and the same check redirects an already-signed-in
visitor away from `/login`/`/signup`. Rejected: gating in the `(app)` layout alone, which would
still flash protected content before redirecting on the client, or checking auth per-page, which
doesn't scale as more protected routes get added.

## 2026-09-26 — Coach login/signup APIs added (branch `feat/commerce-login-signup`)

Requested by Manvendra: real login/signup endpoints, backed by the now-connected Supabase
Postgres instance, with response messages the frontend can show directly.

**Who logs in**: coaches only, for now. The `coaches` table is the only account-holding table in
the schema (per the RLS entry below, "this repo has no auth at all" until now); clients are
Stripe-customer records tied to a coach, not login accounts — self-serve client auth is storefront
scope (Pari's workplan), not this change.

**Mechanism**:
- `coaches.password_hash` (new column, migration `0002_dazzling_risque.sql`) — bcrypt (`bcryptjs`,
  12 rounds), never the plaintext password. See `lib/auth/password.ts`.
- Sessions are a signed JWT (`jose`, HS256, 7-day expiry) in an `httpOnly`/`sameSite=lax` cookie
  (`instar_session`) — not a DB-backed session table. Signed with `AUTH_JWT_SECRET` (new env var,
  see `.env.example`). Simplest thing that works for Sprint 1; revisit for revocable sessions
  (a sessions table, or short-lived tokens + refresh) once there's a reason to invalidate a
  session before its cookie expires.
- Routes: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`. All return the shared `{ success, message, data | (code, fields) }` envelope
  in `lib/api/response.ts` so the frontend has one shape to branch on across every endpoint, not
  just these four.
- No email verification, password reset, or rate limiting yet — out of scope for "login/signup
  APIs" as asked; flag if any of these should land before this goes live.

**Same sandbox-can't-reach-Postgres constraint hit again**: migration `0002` was generated here
but applied via the same hand-off-SQL workaround as `0000`/`0001` (see that section below) — this
session confirmed the same thing again (TCP to the Supabase pooler's `:6543` times out, only `:443`
egresses). The combined hand-off SQL was written for the user to paste into Supabase's SQL Editor,
not committed to the repo.

## 2026-09-26 — Row Level Security enabled on all commerce tables, no policies yet

Made by Manvendra. All 11 Sprint-1 tables now have RLS turned on (`.enableRLS()` in
`lib/commerce/schema.ts`, migration `0001_tiny_hobgoblin.sql`) with **no policies defined**.

**Why now, with nothing enforced yet**: our app never queries these tables through Supabase's
auto-generated REST/GraphQL API — `lib/commerce/db.ts` connects directly via `postgres-js` as the
`postgres` role, and RLS doesn't apply to a table's owner. So turning RLS on costs us nothing today
and closes off the real risk: if that Supabase API is ever pointed at these tables (by accident, by
a future teammate, by a client-side Supabase SDK call), a table with RLS **off** is fully
readable/writable with just the public anon key — for tables holding payment amounts, Stripe ids
and client emails, that's the failure mode worth preventing for free. Supabase's own dashboard
linter flags any public-schema table without RLS as "Unrestricted" for the same reason.

**Why no real policies yet**: a meaningful policy needs to check something like
`auth.uid() = coaches.user_id`, which needs actual auth wired up first (coaches table has no
`user_id`/auth link column yet — this repo has no auth at all, per "What this repo is"). Default
deny via RLS-with-no-policies is the safe placeholder until then; real per-coach scoping is part of
Sprint 6's "coach can only touch their own data" requirement from the workplan, not Sprint 1.

## 2026-09-26 — Week 1 Commerce decisions

Made by Manvendra. Settles the five items `Workplan-Manvendra.md` and `Workplan-Pari.md` both
flagged as blocking Sprint 1.

**1. Stripe Connect account type: Express.**
Fastest KYC/onboarding path for coaches; matches the workplan's own recommendation.

**2. Charge type: destination charges with `on_behalf_of`.**
The platform creates the charge and holds funds (so refunds/disputes/payout timing are centrally
controlled), but `on_behalf_of` is set to the coach's connected account so the **client's card
statement shows the coach's business name**, not the platform's. Disputes route to the platform
first rather than hitting the coach's Stripe balance directly. Rejected: plain destination charges
(statement would show the platform, not the coach — feels wrong for an indie coaching brand) and
direct charges (coach's account becomes merchant of record directly; more setup per Express
account, and pushes dispute handling onto coaches who don't want to deal with it).

**3. Fee display: flat "Service fee" line item, never a labeled surcharge.**
Avoids card-network surcharge rules and the state-by-state rate caps/disclosure requirements that
apply to true surcharges, and it works on debit cards (which true surcharges legally cannot touch).
Computed in `lib/commerce/money.ts`, disclosed to the client before they pay.

**4. Platform take rate: 2% (`PLATFORM_TAKE_RATE_BPS=200`).**
Taken as `application_fee_amount` on the Stripe charge — a share of the offer's base price, not an
extra charge stacked onto what the client pays. Revisit once there's real usage data.

**5. Money representation: integer cents everywhere.**
Not really a decision — adopted as a hard rule. No `numeric`/`float` column or JS number holding a
fractional dollar amount anywhere money is touched.

**Also decided**: the Commerce build lands in this repo (`manvendrapant-sketch/Instar-fit` on
GitHub), not a separate Bitbucket repo as the original workplans assumed. This `Decisions.md`
replaces the Obsidian vault's decision log referenced in those workplans.

**Engineering calls made alongside these (not stakeholder decisions, flagged for visibility)**:
- ORM: Drizzle + `postgres-js`, not Prisma. Revisit if there's a reason to prefer Prisma.
- Database provider not yet chosen (Vercel Postgres / Neon / Supabase all fit).
