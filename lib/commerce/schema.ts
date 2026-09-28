import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Commerce schema (Sprint 1).
 *
 * Conventions:
 * - All money columns are integer minor units (cents) — never numeric/float.
 * - Every table that mirrors a Stripe object keeps that object's id as a unique
 *   text column (`stripe_*_id`) so webhooks can upsert by it.
 * - `*_id` foreign keys use `uuid` (our own ids), Stripe ids are always `text`.
 */

export const offerTypeEnum = pgEnum('offer_type', ['subscription', 'one_time', 'session']);

export const billingIntervalEnum = pgEnum('billing_interval', ['week', 'month', 'year']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
  'disputed',
]);

export const refundInitiatorEnum = pgEnum('refund_initiator', ['coach', 'platform', 'stripe']);

export const refundStatusEnum = pgEnum('refund_status', ['pending', 'succeeded', 'failed']);

export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'in_transit',
  'paid',
  'failed',
  'canceled',
]);

export const coachingModeEnum = pgEnum('coaching_mode', ['online', 'in_person', 'both']);

export const coaches = pgTable(
  'coaches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    handle: text('handle').notNull(),
    email: text('email').notNull(),
    // bcrypt hash — never the plaintext password. See lib/auth/password.ts.
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    // The storefront creator's fields beyond the basics above — all editable via
    // GET/PATCH /api/coach/profile. `specialties`/`location`/`coachingMode` are public
    // (CoachPublicProfile); `timeZone` is used for session/check-in times and is never shown on
    // the public storefront.
    specialties: jsonb('specialties').$type<string[]>().default([]).notNull(),
    location: text('location'),
    coachingMode: coachingModeEnum('coaching_mode').default('online').notNull(),
    timeZone: text('time_zone').default('America/New_York').notNull(),
    // Null until the coach's first PATCH /api/coach/profile — distinguishes "hasn't set up a
    // storefront yet" from "has one with all-default values".
    storefrontCompletedAt: timestamp('storefront_completed_at', { withTimezone: true }),
    // Gates GET /api/coach/[handle] (the public storefront) — set via PATCH /api/storefront, only
    // once the storefront-publish endpoint's readiness gate (Connect payouts ready + >=1 active
    // offer) passes.
    published: boolean('published').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('coaches_handle_idx').on(t.handle), uniqueIndex('coaches_email_idx').on(t.email)],
).enableRLS();

// One row per coach, created once their Stripe Express account exists.
export const connectedAccounts = pgTable(
  'connected_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id, { onDelete: 'cascade' }),
    stripeAccountId: text('stripe_account_id').notNull(),
    chargesEnabled: boolean('charges_enabled').default(false).notNull(),
    payoutsEnabled: boolean('payouts_enabled').default(false).notNull(),
    detailsSubmitted: boolean('details_submitted').default(false).notNull(),
    // Stripe's `requirements.currently_due` — surfaced to the coach so they know what's blocking payouts.
    requirementsDue: jsonb('requirements_due').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('connected_accounts_coach_idx').on(t.coachId),
    uniqueIndex('connected_accounts_stripe_idx').on(t.stripeAccountId),
  ],
).enableRLS();

export const offers = pgTable('offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  coachId: uuid('coach_id')
    .notNull()
    .references(() => coaches.id, { onDelete: 'cascade' }),
  type: offerTypeEnum('type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  // Display order in the offer builder and on the public storefront. Set by
  // PATCH /api/offers/reorder; a newly created offer is appended (max position + 1).
  position: integer('position').default(0).notNull(),
  // Bullet points shown under the offer's description, e.g. "Weekly check-in".
  includes: jsonb('includes').$type<string[]>().default([]).notNull(),
  // Set only for `one_time` offers; null for subscription / session.
  lengthWeeks: integer('length_weeks'),
  // Set only for `session` offers; null for subscription / one_time.
  sessionMinutes: integer('session_minutes'),
  stripeProductId: text('stripe_product_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const prices = pgTable('prices', {
  id: uuid('id').defaultRandom().primaryKey(),
  offerId: uuid('offer_id')
    .notNull()
    .references(() => offers.id, { onDelete: 'cascade' }),
  stripePriceId: text('stripe_price_id'),
  currency: text('currency').default('usd').notNull(),
  unitAmountCents: integer('unit_amount_cents').notNull(),
  // Set only for `subscription` offers; null for one_time / session.
  interval: billingIntervalEnum('interval'),
  intervalCount: integer('interval_count').default(1),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id'),
    email: text('email').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('clients_stripe_customer_idx').on(t.stripeCustomerId)],
).enableRLS();

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    offerId: uuid('offer_id')
      .notNull()
      .references(() => offers.id),
    priceId: uuid('price_id')
      .notNull()
      .references(() => prices.id),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    pauseResumesAt: timestamp('pause_resumes_at', { withTimezone: true }),
    pauseReason: text('pause_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('subscriptions_stripe_idx').on(t.stripeSubscriptionId)],
).enableRLS();

// A payment is the client-facing charge: base offer price + the disclosed service fee.
// `platformFeeCents` is Instar's take (application_fee_amount on the Stripe charge), a subset
// of `baseAmountCents` — it is not added on top of what the client pays.
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    offerId: uuid('offer_id').references(() => offers.id),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeChargeId: text('stripe_charge_id'),
    currency: text('currency').default('usd').notNull(),
    baseAmountCents: integer('base_amount_cents').notNull(),
    serviceFeeCents: integer('service_fee_cents').notNull(),
    totalAmountCents: integer('total_amount_cents').notNull(),
    platformFeeCents: integer('platform_fee_cents').notNull(),
    status: paymentStatusEnum('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('payments_intent_idx').on(t.stripePaymentIntentId)],
).enableRLS();

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    stripeRefundId: text('stripe_refund_id'),
    amountCents: integer('amount_cents').notNull(),
    reason: text('reason'),
    initiatedBy: refundInitiatorEnum('initiated_by').notNull(),
    status: refundStatusEnum('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('refunds_stripe_idx').on(t.stripeRefundId)],
).enableRLS();

export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    stripeDisputeId: text('stripe_dispute_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    reason: text('reason'),
    // Mirrors Stripe's own dispute status strings verbatim (e.g. needs_response, under_review).
    status: text('status').notNull(),
    evidenceDueBy: timestamp('evidence_due_by', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('disputes_stripe_idx').on(t.stripeDisputeId)],
).enableRLS();

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id),
    stripePayoutId: text('stripe_payout_id'),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').default('usd').notNull(),
    status: payoutStatusEnum('status').notNull(),
    arrivalDate: timestamp('arrival_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('payouts_stripe_idx').on(t.stripePayoutId)],
).enableRLS();

// Every Stripe webhook we accept lands here first, keyed by Stripe's own event id.
// The unique index is the dedupe mechanism a retried/duplicate delivery relies on.
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stripeEventId: text('stripe_event_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('webhook_events_stripe_id_idx').on(t.stripeEventId)],
).enableRLS();

// A client's magic-link login request. `tokenHash` (sha256 of the random token — never the raw
// token itself) is what's stored, so a DB leak alone can't be used to log in as a client; the raw
// token only ever exists in the emailed link and briefly in memory while verifying it. Single-use
// (`usedAt`) and short-lived (`expiresAt`, ~15 min) by design — a client requests a fresh one every
// time they want in, never a standing reusable link. Scoped to one `clients` row (one coach
// relationship), matching this app's current per-coach client model — not a cross-coach identity.
export const clientLoginTokens = pgTable(
  'client_login_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('client_login_tokens_hash_idx').on(t.tokenHash)],
).enableRLS();
