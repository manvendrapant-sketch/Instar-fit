# Decisions

A durable log of the calls made on the Commerce pillar, so the reasoning travels with the code
instead of living only in a chat or an Obsidian vault. Newest first. Add to this, don't rewrite it.

---

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
