import 'dotenv/config';
import Stripe from 'stripe';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { getDb } from '../lib/commerce/db';
import { payments, subscriptions } from '../lib/commerce/schema';

/**
 * One-off backfill for subscription payments recorded before the invoice.payments-lookup fix
 * (see CLAUDE.md's "A fourth instance of the same expandable-field bug" entry, 2026-09-28).
 * Every subscription billing-cycle payment written by the old `handleInvoicePaid` has both
 * `stripePaymentIntentId` and `stripeChargeId` null, which makes `POST
 * /api/coach/payments/[id]/refund` 422 NOT_REFUNDABLE for every one of them.
 *
 * This app's `payments` table has no direct reference to the Stripe invoice that produced a row,
 * so for each affected row this finds the paid invoice on that subscription whose Stripe `created`
 * timestamp is closest to the row's own `createdAt` — `handleInvoicePaid` writes the row moments
 * after the `invoice.paid` webhook fires, so these are normally seconds apart, not guesswork. Skips
 * (and logs, doesn't silently drop) any row whose closest invoice is more than `MAX_DRIFT_MS` away,
 * or where two rows would otherwise match the same invoice — reversing a refund's fee-split against
 * the wrong charge is worse than leaving a row unfixed for manual review.
 *
 * Constructs its own Stripe client rather than importing lib/stripe/client.ts's getStripe(): that
 * file imports `server-only`, which unconditionally throws outside Next's own bundler (confirmed
 * directly against node_modules/server-only/index.js) — this script runs under tsx, not Next.
 *
 * Run with: npm run db:backfill-payment-ids (requires DATABASE_URL and STRIPE_SECRET_KEY pointing
 * at the real production database and the same Stripe environment those payments were made in —
 * this sandbox has no access to either, so this must be run from somewhere that does).
 */

const MAX_DRIFT_MS = 10 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

async function main() {
  const db = getDb();
  const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-08-26.dahlia',
    typescript: true,
  });

  const affected = await db
    .select({ id: payments.id, createdAt: payments.createdAt, stripeSubscriptionId: subscriptions.stripeSubscriptionId })
    .from(payments)
    .innerJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
    .where(and(isNotNull(payments.subscriptionId), isNull(payments.stripePaymentIntentId), isNull(payments.stripeChargeId)));

  console.log(`Found ${affected.length} subscription payment(s) with no Stripe id.`);

  const usedInvoiceIds = new Set<string>();
  let fixed = 0;
  let skipped = 0;

  for (const row of affected) {
    const invoices = await stripe.invoices.list({ subscription: row.stripeSubscriptionId, status: 'paid', limit: 100 });

    let bestInvoiceId: string | null = null;
    let bestDriftMs = Infinity;
    for (const inv of invoices.data) {
      if (usedInvoiceIds.has(inv.id)) continue;
      const driftMs = Math.abs(inv.created * 1000 - row.createdAt.getTime());
      if (driftMs < bestDriftMs) {
        bestDriftMs = driftMs;
        bestInvoiceId = inv.id;
      }
    }

    if (!bestInvoiceId || bestDriftMs > MAX_DRIFT_MS) {
      console.warn(
        `SKIP payments.id=${row.id}: no unmatched paid invoice within ${MAX_DRIFT_MS / 1000}s of ${row.createdAt.toISOString()}` +
          (bestInvoiceId ? ` (closest was ${Math.round(bestDriftMs / 1000)}s away)` : ' (no paid invoices found at all)'),
      );
      skipped++;
      continue;
    }

    const invoicePayments = await stripe.invoicePayments.list({ invoice: bestInvoiceId, limit: 1 });
    const firstPayment = invoicePayments.data[0]?.payment;
    const paymentIntentId =
      firstPayment?.type === 'payment_intent'
        ? (typeof firstPayment.payment_intent === 'string' ? firstPayment.payment_intent : (firstPayment.payment_intent?.id ?? null))
        : null;
    const chargeId =
      firstPayment?.type === 'charge'
        ? (typeof firstPayment.charge === 'string' ? firstPayment.charge : (firstPayment.charge?.id ?? null))
        : null;

    if (!paymentIntentId && !chargeId) {
      console.warn(`SKIP payments.id=${row.id}: matched invoice ${bestInvoiceId} but it has no payment_intent/charge either`);
      skipped++;
      continue;
    }

    usedInvoiceIds.add(bestInvoiceId);
    await db.update(payments).set({ stripePaymentIntentId: paymentIntentId, stripeChargeId: chargeId }).where(eq(payments.id, row.id));
    console.log(`FIXED payments.id=${row.id} <- invoice ${bestInvoiceId} (${paymentIntentId ?? chargeId})`);
    fixed++;
  }

  console.log(`Done. Fixed ${fixed}, skipped ${skipped}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
