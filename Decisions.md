# Decisions

A durable log of the calls made on the Commerce pillar, so the reasoning travels with the code
instead of living only in a chat or an Obsidian vault. Newest first. Add to this, don't rewrite it.

---

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
