import 'server-only';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import { subscriptions, payments, clientLoginTokens } from './schema';
import { upsertClient } from './clients';
import { computeCheckoutBreakdown } from './money';
import { mapSubscriptionStatus, subscriptionSyncFields } from './subscriptions';
import { getStripe } from '@/lib/stripe/client';
import { generateLoginToken, hashLoginToken, LOGIN_TOKEN_TTL_MS } from '@/lib/auth/clientToken';
import { sendDunningEmail } from '@/lib/email/send';

type Db = PostgresJsDatabase<typeof schema>;
type SubscriptionStatus = (typeof subscriptions.$inferInsert)['status'];

function metaStr(meta: Stripe.Metadata | null | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v ? v : undefined;
}

/**
 * Fires for both one-time and subscription checkouts. Always upserts the client; for a
 * subscription it also records the `subscriptions` row, so `invoice.paid` (which only carries a
 * bare Stripe subscription id) can join back to our own offerId/priceId/coachId later.
 */
export async function handleCheckoutSessionCompleted(db: Db, session: Stripe.Checkout.Session): Promise<void> {
  const coachId = metaStr(session.metadata, 'coachId');
  const offerId = metaStr(session.metadata, 'offerId');
  const email = session.customer_details?.email ?? metaStr(session.metadata, 'clientEmail');
  if (!coachId || !offerId || !email) {
    console.error(`checkout.session.completed ${session.id}: missing coachId/offerId/email, skipping`);
    return;
  }

  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
  const client = await upsertClient(db, {
    coachId,
    email,
    name: session.customer_details?.name ?? null,
    stripeCustomerId,
  });

  if (session.mode !== 'subscription' || !session.subscription) return;

  const stripeSubscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const existing = await db.query.subscriptions.findFirst({
    where: (s, { eq: eqCol }) => eqCol(s.stripeSubscriptionId, stripeSubscriptionId),
  });
  if (existing) return;

  const priceRow = await db.query.prices.findFirst({
    where: (p, { eq: eqCol, and: andCol }) => andCol(eqCol(p.offerId, offerId), eqCol(p.active, true)),
  });
  if (!priceRow) {
    console.error(`checkout.session.completed ${session.id}: no active price for offer ${offerId}`);
    return;
  }

  let status: SubscriptionStatus = 'incomplete';
  let currentPeriodEnd: Date | null = null;
  try {
    const sub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
    status = mapSubscriptionStatus(sub.status);
    const periodEnd = sub.items.data[0]?.current_period_end;
    currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;
  } catch (err) {
    console.error(`checkout.session.completed ${session.id}: failed to retrieve subscription ${stripeSubscriptionId}:`, err);
  }

  await db
    .insert(subscriptions)
    .values({ clientId: client.id, offerId, priceId: priceRow.id, stripeSubscriptionId, status, currentPeriodEnd })
    .onConflictDoNothing({ target: subscriptions.stripeSubscriptionId });
}

/**
 * Only ever matches a one-time (non-subscription) Checkout payment: `createCheckoutSession` sets
 * `payment_intent_data.metadata` exclusively on `mode: 'payment'` sessions, so a subscription
 * invoice's own auto-generated PaymentIntent carries none of these keys and this is a no-op for
 * it — `invoice.paid` records that instead, since it's the only event with the right subscription
 * linkage.
 */
export async function handlePaymentIntentSucceeded(db: Db, pi: Stripe.PaymentIntent): Promise<void> {
  const coachId = metaStr(pi.metadata, 'coachId');
  const offerId = metaStr(pi.metadata, 'offerId');
  const email = metaStr(pi.metadata, 'clientEmail');
  const baseAmountCents = Number(metaStr(pi.metadata, 'baseAmountCents'));
  if (!coachId || !offerId || !email || !Number.isFinite(baseAmountCents)) return;

  const client = await upsertClient(db, {
    coachId,
    email,
    name: null,
    stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : (pi.customer?.id ?? null),
  });

  const breakdown = computeCheckoutBreakdown(baseAmountCents, metaStr(pi.metadata, 'currency') ?? pi.currency);
  const stripeChargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge?.id ?? null);

  await db
    .insert(payments)
    .values({
      coachId,
      clientId: client.id,
      offerId,
      stripePaymentIntentId: pi.id,
      stripeChargeId,
      currency: breakdown.currency,
      baseAmountCents: breakdown.baseAmountCents,
      serviceFeeCents: breakdown.serviceFeeCents,
      totalAmountCents: breakdown.totalAmountCents,
      platformFeeCents: breakdown.platformFeeCents,
      status: 'succeeded',
    })
    .onConflictDoNothing({ target: payments.stripePaymentIntentId });
}

/**
 * Records a subscription billing cycle's payment. Amounts are recomputed from our own price row
 * via `computeCheckoutBreakdown` rather than trusted from the invoice, keeping this consistent
 * with every other MoneyBreakdown in the app rather than a second source of truth for fees.
 */
export async function handleInvoicePaid(db: Db, invoice: Stripe.Invoice): Promise<void> {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
  if (!stripeSubscriptionId) return; // not a subscription invoice — out of Sprint 3's scope.

  const subscription = await db.query.subscriptions.findFirst({
    where: (s, { eq: eqCol }) => eqCol(s.stripeSubscriptionId, stripeSubscriptionId),
  });
  if (!subscription) {
    console.error(`invoice.paid ${invoice.id}: no subscriptions row for ${stripeSubscriptionId} yet, skipping`);
    return;
  }

  const [client, priceRow] = await Promise.all([
    db.query.clients.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, subscription.clientId) }),
    db.query.prices.findFirst({ where: (p, { eq: eqCol }) => eqCol(p.id, subscription.priceId) }),
  ]);
  if (!client || !priceRow) {
    console.error(`invoice.paid ${invoice.id}: missing client/price row for subscription ${stripeSubscriptionId}`);
    return;
  }

  const breakdown = computeCheckoutBreakdown(priceRow.unitAmountCents, priceRow.currency);
  // Best-effort only: `payments` is an includable field, not guaranteed present on every webhook
  // delivery. A null id here just means the payments row records the amounts without a Stripe
  // PaymentIntent/Charge cross-reference, not that anything failed.
  const firstPayment = invoice.payments?.data?.[0]?.payment;
  const paymentIntentId =
    firstPayment?.type === 'payment_intent'
      ? (typeof firstPayment.payment_intent === 'string' ? firstPayment.payment_intent : (firstPayment.payment_intent?.id ?? null))
      : null;
  const chargeId =
    firstPayment?.type === 'charge'
      ? (typeof firstPayment.charge === 'string' ? firstPayment.charge : (firstPayment.charge?.id ?? null))
      : null;

  await db
    .insert(payments)
    .values({
      coachId: client.coachId,
      clientId: client.id,
      offerId: subscription.offerId,
      subscriptionId: subscription.id,
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: chargeId,
      currency: breakdown.currency,
      baseAmountCents: breakdown.baseAmountCents,
      serviceFeeCents: breakdown.serviceFeeCents,
      totalAmountCents: breakdown.totalAmountCents,
      platformFeeCents: breakdown.platformFeeCents,
      status: 'succeeded',
    })
    .onConflictDoNothing({ target: payments.stripePaymentIntentId });

  if (subscription.status !== 'active') {
    await db.update(subscriptions).set({ status: 'active', updatedAt: new Date() }).where(eq(subscriptions.id, subscription.id));
  }
}

/** Shared by the two dunning events — both only carry a bare Stripe subscription id. */
async function findSubscriptionByInvoice(db: Db, invoice: Stripe.Invoice) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
  if (!stripeSubscriptionId) return null;
  return (
    (await db.query.subscriptions.findFirst({
      where: (s, { eq: eqCol }) => eqCol(s.stripeSubscriptionId, stripeSubscriptionId),
    })) ?? null
  );
}

/**
 * The dunning nudge itself: mints the same single-use magic-link token login already uses (so
 * "update your card" is one tap, no password), and emails it. Never throws — an email-provider
 * hiccup here shouldn't fail the whole webhook delivery and trigger a Stripe retry.
 */
async function sendDunningNudge(
  db: Db,
  origin: string,
  subscription: typeof subscriptions.$inferSelect,
  reason: 'failed' | 'action_required',
): Promise<void> {
  try {
    const [client, offer] = await Promise.all([
      db.query.clients.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, subscription.clientId) }),
      db.query.offers.findFirst({ where: (o, { eq: eqCol }) => eqCol(o.id, subscription.offerId) }),
    ]);
    if (!client) return;
    const coach = await db.query.coaches.findFirst({ where: (c, { eq: eqCol }) => eqCol(c.id, client.coachId) });
    if (!coach) return;

    const rawToken = generateLoginToken();
    await db.insert(clientLoginTokens).values({
      clientId: client.id,
      tokenHash: hashLoginToken(rawToken),
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
    });
    const loginUrl = new URL(`/api/client/login/verify?token=${rawToken}`, origin).toString();

    await sendDunningEmail(client.email, loginUrl, coach.displayName, offer?.name ?? 'your subscription', reason);
  } catch (err) {
    console.error(`sendDunningNudge (${reason}) failed for subscription ${subscription.id}:`, err);
  }
}

/**
 * Only ever sends the nudge — never writes `subscriptions.status` itself. `customer.subscription.
 * updated` (via handleSubscriptionSynced) is the single source of truth for status, so two
 * handlers can't race to write conflicting values from events whose delivery order Stripe doesn't
 * guarantee.
 */
export async function handleInvoicePaymentFailed(db: Db, invoice: Stripe.Invoice, origin: string): Promise<void> {
  const subscription = await findSubscriptionByInvoice(db, invoice);
  if (!subscription) return;
  await sendDunningNudge(db, origin, subscription, 'failed');
}

export async function handleInvoicePaymentActionRequired(db: Db, invoice: Stripe.Invoice, origin: string): Promise<void> {
  const subscription = await findSubscriptionByInvoice(db, invoice);
  if (!subscription) return;
  await sendDunningNudge(db, origin, subscription, 'action_required');
}

/**
 * One shared handler for every subscription-lifecycle event Stripe sends
 * (`customer.subscription.updated/deleted/paused/resumed`) — all four are "here's the
 * subscription's current state, sync it," so there's no benefit to four near-duplicate handlers.
 * This also satisfies "pause -> auto-resume" for free: Stripe itself clears `pause_collection` at
 * `resumes_at` and fires `.resumed`, which lands here like any other sync.
 */
export async function handleSubscriptionSynced(db: Db, sub: Stripe.Subscription): Promise<void> {
  const existing = await db.query.subscriptions.findFirst({
    where: (s, { eq: eqCol }) => eqCol(s.stripeSubscriptionId, sub.id),
  });
  if (!existing) {
    console.error(`customer.subscription synced ${sub.id}: no subscriptions row yet, skipping`);
    return;
  }

  const fields = subscriptionSyncFields(sub, existing.pauseReason);

  await db
    .update(subscriptions)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(subscriptions.id, existing.id));
}

/** The one place a Stripe event type is routed to its handler — see app/api/webhooks/stripe/route.ts. */
export async function dispatchWebhookEvent(db: Db, event: Stripe.Event, origin: string): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(db, event.data.object as Stripe.Checkout.Session);
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(db, event.data.object as Stripe.PaymentIntent);
    case 'invoice.paid':
      return handleInvoicePaid(db, event.data.object as Stripe.Invoice);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(db, event.data.object as Stripe.Invoice, origin);
    case 'invoice.payment_action_required':
      return handleInvoicePaymentActionRequired(db, event.data.object as Stripe.Invoice, origin);
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return handleSubscriptionSynced(db, event.data.object as Stripe.Subscription);
    default:
      // Every other event type (account.updated, etc.) is stored for the record but has no
      // handler yet — see CLAUDE.md for what's Sprint 2+ scope.
      return;
  }
}
