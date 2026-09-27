# Decisions

A durable log of the calls made on the Commerce pillar, so the reasoning travels with the code
instead of living only in a chat or an Obsidian vault. Newest first. Add to this, don't rewrite it.

---

## 2026-09-27 — Sprint 4 completed for both workplans: recurring billing, dunning, pause, client self-serve

Manvendra asked to complete Sprint 4 for both Manvendra's (`Workplan-Manvendra.md`, "Recurring
billing + dunning + pause") and Pari's (`Workplan-Pari.md`, "Client self-serve (billing, pause)")
workplans in one pass, after confirming that of the five items in Manvendra's Sprint 4, none had
actually been built yet — only the client magic-link login (the entry directly below this one) was
in place as shared infrastructure. No schema change was needed: Sprint 1's `subscriptions` table
already had `status` (with `paused`/`past_due`/`canceled` in its enum), `pauseResumesAt` and
`pauseReason` — this pass is all application logic on top of columns that already existed.

**Stripe quirk that reshaped the whole design, confirmed against this pinned SDK's own `.d.ts`
files, not assumed**: setting `pause_collection` on a subscription does **not** change Stripe's own
`Subscription.status` — a real Stripe `status: 'paused'` means something unrelated (a trial that
ended with no payment method on file). So our own `status: 'paused'` can't be a passthrough of
Stripe's status field; `lib/commerce/subscriptions.ts`'s `subscriptionSyncFields` derives it
instead: whenever `pause_collection.resumes_at` is set, we report `paused` regardless of what
Stripe's status says underneath (which stays `active`), and fall back to the real mapped status the
moment `pause_collection` clears — whether we cleared it (resume/cancel) or Stripe did automatically
at `resumes_at`. Getting this wrong would have meant any unrelated `customer.subscription.updated`
webhook silently un-pausing a client's row in our own database while the client was still actually
paused on Stripe's side.

**`customer.subscription.paused`/`.resumed` events exist in this Stripe API version but are a red
herring for this feature** — they fire for the trial/no-payment-method case above, not for
`pause_collection`. They're still routed to the same `handleSubscriptionSynced` handler as
`.updated`/`.deleted` (harmless — that handler just re-syncs from whatever the Subscription object
says), but the actual "pause -> auto-resume" signal this feature relies on is an ordinary
`customer.subscription.updated` firing once Stripe auto-clears `pause_collection` at `resumes_at`.

**Dunning nudge reuses the magic-link token mechanism** (`client_login_tokens`,
`generateLoginToken`/`hashLoginToken`, 15-minute single-use tokens) rather than inventing a second
token system — `invoice.payment_failed`/`invoice.payment_action_required` mint one and email it via
a new `sendDunningEmail`, so "one-tap card update" is: click the email, land already logged in, hit
"Update card". These two handlers deliberately never write `subscriptions.status` themselves —
`customer.subscription.updated` (via `handleSubscriptionSynced`) stays the single source of truth
for status, so two handlers can't race to write conflicting values from events whose delivery order
Stripe doesn't guarantee.

**Cancel is immediate, not at period end.** Neither workplan specifies which; immediate is the
simpler of the two reasonable readings and needed no new "cancels on <date>" field in the shared
contract. Revisit if "keep access until the period already paid for ends" is ever asked for
explicitly — that would need a `cancelAtPeriodEnd` field Pari's UI doesn't have today.

**Card update via the Stripe Customer Portal**, per the workplan's own "Stripe Customer Portal
session or our own update-card endpoint" wording — the Portal is the option named first. Needs a
Customer Portal Configuration to exist in the Stripe Dashboard (Settings -> Billing -> Customer
portal) before `billingPortal.sessions.create()` will succeed in production; this is a
Dashboard-only step this session cannot do or verify (same standing sandbox limitation as
Stripe/Postgres network access elsewhere in this repo's history).

**Stripe Smart Retries** (Manvendra's Sprint 4 second bullet) is also Dashboard-only config
(Billing -> Subscriptions and emails -> Manage retries) — nothing in code enables or disables it;
flagged here so it isn't mistaken for something this pass forgot to wire up.

**Coach view of client status** (`GET /api/coach/clients`, `/business/clients`) is one row per
subscription, not per client — a client with two subscriptions to the same coach appears twice,
matching how `CoachClientSummary` was already shaped in `types.ts` before this pass (added
alongside the client-facing types, ahead of building either side, so both could be built against a
settled contract).

**Not done / deliberately out of scope**: no live-Stripe or live-DB verification (same standing gap
as every other pass in this repo's history — this sandbox reaches neither); no component-rendering
tests for the new `ClientAccountView`/`ClientsPage`/`PauseForm`/`SubscriptionCard` (consistent with
every other component in this repo); reconciling an offer's orphaned Stripe product/price across a
key rotation remains unhandled, unrelated to this pass.

## 2026-09-27 — Client magic-link login (Sprint 4, backend + minimal frontend)

Manvendra asked what's next after Sprint 3 closed; Sprint 4 of `Workplan-Pari.md` is client
self-serve billing, whose first bullet names its own mechanism explicitly: *"Client 'My
subscription' page (magic-link login)"* — not left to interpretation, so this wasn't a design
choice made here, just followed.

**Scoped to one coach relationship, not a cross-coach client identity.** Manvendra asked whether a
client who's bought from multiple coaches should see one unified dashboard, then explicitly decided
against building that now: the workplan doesn't mention it, so it isn't built. Today's `clients`
rows are still keyed `(coachId, email)` with no identity above that; a client with purchases from
two coaches logs into each separately, at `/<their-coach's-handle>/account`. Revisit only if a
unified client account becomes an explicit requirement — retrofitting it later means migrating
every existing `clients`/`subscriptions`/`payments` row onto a new identity table, so this is a
deliberate scope call, not an oversight.

**Magic link, not password, and here's why "just add normal login" doesn't actually save work**:
any password-based login still needs to prove the client owns their email before they can set one
— since no client has ever set a password, that first step is itself a magic-link-shaped email
verification. So "normal login" would mean building a magic link *and* a password on top of it, for
worse UX (one more thing to remember) on a page most clients open once a billing cycle. Rejected.

**Single-use, short-lived tokens, stored hashed — not a bare JWT link.** Unlike the coach session
(a self-contained signed JWT, no DB row, chosen in the original login/signup pass for simplicity),
a login *link* needed to be revocable the instant it's clicked: `client_login_tokens` stores only
`sha256(token)` (a DB leak alone can't be used to log in), expires in 15 minutes, and is marked
`usedAt` atomically on redemption (`UPDATE ... WHERE usedAt IS NULL RETURNING ...` — if that returns
no rows, something already consumed it, including two near-simultaneous clicks on the same link).
Rejected: a stateless JWT link like the coach session uses, which can't be invalidated early and
has no natural single-use guarantee.

**Once redeemed, the client gets a real session** — `instar_client_session`, a JWT again, but
signed with its own `CLIENT_SESSION_JWT_SECRET`, deliberately separate from `AUTH_JWT_SECRET`.
Coaches and clients are different trust domains (a coach can see every client across their whole
business; a client can only ever see their own one relationship with one coach) — a future bug that
confused the two token families should be structurally impossible, not just unlikely, so they don't
share a signing key even though nothing currently would misuse it. 30-day cookie lifetime (clients
check in occasionally, not daily like a coach) — a fresh login link is still needed to establish it.

**Email sending: Resend, chosen by Manvendra directly when asked** (this app had zero
email-sending capability before this — no receipt/dunning email infra existed either). Lazy client
(`lib/email/resend.ts`), same gotcha as every other external client in this app (`getStripe()`,
`getDb()`) — must not construct at module scope or `next build` fails whenever the key is unset.
`sendMagicLinkEmail` is the one function that sends this one email; a future receipt or dunning
email is a separate function, not a parameter bolted onto this one.

**The login-request and account pages query the DB directly from the page component** — the one
deliberate exception to this app's usual "pages fetch through an API route" convention (see
`CLAUDE.md`). `GET /api/coach/[handle]` (the public storefront endpoint) is gated by
`coaches.published`, but a client who bought before their coach unpublished still needs to log in
and see their own subscription — reusing that endpoint would incorrectly block them. A direct,
try/caught `getDb()` call was simpler than adding a second coach-lookup endpoint whose only
difference is "don't check `published`."

---

## 2026-09-27 — Stripe webhook endpoint registered, Sprint 3 closed out

Manvendra asked to close off the one remaining gap in Sprint 3. This session's sandbox has no path
to `api.stripe.com` (a direct request gets a 403 from the container's egress proxy — an
organization policy, confirmed by testing, not a token/permission problem) and no Stripe MCP
connector exists here, so unlike everything else in Sprint 3, **registering the endpoint itself
could not be automated** — it was the one manual Dashboard step in this whole pillar so far that
had no workaround. Manvendra registered it directly (endpoint `https://instar-fit.vercel.app
/api/webhooks/stripe`, in the Instar Sandbox environment, subscribed to
`checkout.session.completed`/`payment_intent.succeeded`/`invoice.paid`) and pasted back the signing
secret; this session set `STRIPE_WEBHOOK_SECRET` in Vercel and redeployed. See `CLAUDE.md` for the
mechanics. Nothing about the webhook handler code changed — this was pure configuration.

---

## 2026-09-27 — Sprint 3 (Checkout backend), branch `feat/commerce-checkout`

Picked as the next thing to build after reviewing `Workplan-Manvendra.md`'s remaining sprints
(recommended over Sprint 4/5 since nothing else can generate a real payment to test against until
checkout exists). Branched from `main` at the tip that already has migrations 0000-0004 applied and
the storefront/offers/payouts APIs. No schema changes this pass — `offers.stripeProductId` and
`prices.stripePriceId` (Sprint-1/2 columns) are exactly what checkout needs.

**Fee application is exact for one-time offers, approximate for subscriptions — this is a real,
disclosed trade-off, not an oversight.** Stripe Connect's application fee on a plain payment
(`payment_intent_data.application_fee_amount`) is a fixed cents amount, so a one-time Checkout can
take exactly `platformFeeCents` (2% of the base price only) regardless of what else is on the
invoice. A Subscription's application fee (`subscription_data.application_fee_percent`) can only be
a *percentage of the whole invoice*, and our Checkout Session bills the base price and the
disclosed Service fee as two separate line items on that same invoice — so the percentage
necessarily also takes its cut of the Service fee line, not just of the base price. Rejected:
billing the fee as a separate off-Checkout invoice item just to keep the application fee exact,
which would mean building real invoicing outside Stripe Checkout for what's still a small
percentage discrepancy. Revisit if/when the exact number matters (financial reporting, an audit) —
until then this is Sprint 3's known approximation, not Sprint 6 hardening scope.

**The full `MoneyBreakdown` (base + fee + total + platform's cut) is snapshotted into Checkout
metadata as strings at session-creation time**, and the webhook handlers recompute a `payments` row
from that snapshot (one-time) or by re-running `computeCheckoutBreakdown` against the `prices` row
a subscription is pinned to (recurring) — never by trusting Stripe's own invoice/PaymentIntent
amounts directly. Rejected: reading `amount_paid`/`amount_received` off the Stripe object, which
would make Stripe's math a second, potentially-diverging source of truth for the exact numbers the
workplan asked this helper to be the single source of.

**`GET /api/checkout/quote`'s response deliberately omits `platformFeeCents`**, unlike the coach-only
`GET /api/offers/quote` (which already includes it, via a plain object spread of `money.ts`'s
server-side `MoneyBreakdown`, not something this pass touches). The offer builder's audience is the
coach, who has reason to see their own take-home number; the checkout quote's audience is an
anonymous client, for whom disclosing the platform's exact cut has no product reason and mildly
undercuts the "flat service fee, not itemized further" framing of decision #3 above. `types.ts`'s
shared `MoneyBreakdown` was already shaped to exclude it — this pass is the first thing that
actually enforces that by constructing the response explicitly rather than spreading.

**Webhook idempotency was tightened from "row exists" to "row has `processedAt` set."** The
pre-Sprint-3 webhook route recorded an event and returned 200 *before* any handler ran (there was no
per-event-type handler at all yet), so "the row exists" and "the event was fully handled" were the
same fact. Once handlers exist and can throw partway through (e.g. a DB error after the client
upsert but before the payment insert), those two facts diverge: a retried delivery whose first
attempt crashed would find the row already there via `onConflictDoNothing` and skip reprocessing
forever under the old logic, permanently losing that webhook. `webhook_events.processedAt` (already
in the Sprint-1 schema, previously unused) is now set only after `dispatchWebhookEvent` returns
without throwing; a conflict on insert with `processedAt` still null is treated as "retry me," not
"duplicate." Rejected: a separate `webhook_processing_log` table, which would duplicate what
`processedAt` already gives us for free.

**Client upsert keys on `(coachId, email)`, not `stripeCustomerId`.** At session-creation time we
don't yet have a Stripe customer id (Checkout creates the Customer during the flow); at
`checkout.session.completed` time we do, so it's saved then, but email is the identifier available
throughout and is what a repeat client will match on across separate checkouts. No DB unique
constraint enforces this (see `clients` in `schema.ts` — only `stripeCustomerId` has one) — a race
could in theory create two rows for the same person; accepted as consistent with how loosely this
schema is constrained elsewhere (offers/prices have no analogous DB-level guards either).

**`payment_intent.succeeded` and `invoice.paid` are kept strictly non-overlapping by metadata
presence, not by inspecting `PaymentIntent.invoice`.** The Stripe API version this app is pinned to
(`2026-08-26.dahlia`) removed the direct `invoice`/`subscription`/`charge` fields from
`PaymentIntent` and `Invoice` in favor of `invoice.parent.subscription_details.subscription` and
`invoice.payments[].payment.{payment_intent,charge}` — a real, checked-against-the-installed-SDK
breaking change from older Stripe docs/training data, per `AGENTS.md`'s warning that this isn't the
Stripe (or Next.js) anyone's used before. Practical effect: `createCheckoutSession` only ever sets
`payment_intent_data.metadata` for one-time (`mode: 'payment'`) sessions, never for subscriptions —
so a bare `pi.metadata.offerId` check alone is enough to tell "one-time Checkout payment, handle it
here" from "some other PaymentIntent (a subscription invoice's own, or anything unrelated), leave it
to `invoice.paid`" apart, without needing the now-removed field.

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
