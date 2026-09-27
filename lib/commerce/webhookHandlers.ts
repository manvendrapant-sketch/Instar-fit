import 'server-only';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import { subscriptions, payments } from './schema';
import { upsertClient } from './clients';
import { computeCheckoutBreakdown } from './money';
import { getStripe } from '@/lib/stripe/client';

type Db = PostgresJsDatabase<typeof schema>;
type SubscriptionStatus = (typeof subscriptions.$inferInsert)['status'];

function metaStr(meta: Stripe.Metadata | null | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v ? v : undefined;
}

/**
 * Stripe's own Subscription.status has two values our coarser DB enum doesn't: `incomplete_expired`
 * (mapped to `canceled` — it never became payable) and `unpaid` (mapped to `past_due` — real
 * dunning handling is Sprint 4, but this is the closest of our six states until then).
 */
function mapSubscriptionStatus(status: string): SubscriptionStatus {
  if (status === 'incomplete_expired') return 'canceled';
  if (status === 'unpaid') return 'past_due';
  const known: SubscriptionStatus[] = ['incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled'];
  return (known as string[]).includes(status) ? (status as SubscriptionStatus) : 'incomplete';
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

/** The one place a Stripe event type is routed to its handler — see app/api/webhooks/stripe/route.ts. */
export async function dispatchWebhookEvent(db: Db, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(db, event.data.object as Stripe.Checkout.Session);
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(db, event.data.object as Stripe.PaymentIntent);
    case 'invoice.paid':
      return handleInvoicePaid(db, event.data.object as Stripe.Invoice);
    default:
      // Every other event type (account.updated, etc.) is stored for the record but has no
      // handler yet — see CLAUDE.md for what's Sprint 2+ scope.
      return;
  }
}
