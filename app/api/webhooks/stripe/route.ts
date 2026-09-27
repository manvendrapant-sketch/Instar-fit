import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/client';
import { getDb } from '@/lib/commerce/db';
import { webhookEvents } from '@/lib/commerce/schema';
import { dispatchWebhookEvent } from '@/lib/commerce/webhookHandlers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  const db = getDb();

  const inserted = await db
    .insert(webhookEvents)
    .values({ stripeEventId: event.id, type: event.type, payload: event as unknown as object })
    .onConflictDoNothing({ target: webhookEvents.stripeEventId })
    .returning({ id: webhookEvents.id, processedAt: webhookEvents.processedAt });

  // A conflict here is normally a genuine duplicate delivery — but if a previous attempt's handler
  // crashed after this row was first inserted and before `processedAt` was ever set, it means
  // Stripe is retrying a delivery we never actually finished. Reprocess it rather than silently
  // dropping it: row existence alone isn't proof the event was handled, only `processedAt` is.
  let row: { id: string; processedAt: Date | null } | undefined = inserted[0];
  if (!row) {
    const existing = await db.query.webhookEvents.findFirst({
      where: (w, { eq: eqCol }) => eqCol(w.stripeEventId, event.id),
    });
    if (existing?.processedAt) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    row = existing ? { id: existing.id, processedAt: existing.processedAt } : undefined;
  }
  if (!row) {
    // Shouldn't happen — the insert conflicted but the row can't be found. Ask Stripe to retry.
    return NextResponse.json({ error: 'Could not record webhook event' }, { status: 500 });
  }

  try {
    await dispatchWebhookEvent(db, event, new URL(req.url).origin);
  } catch (err) {
    console.error(`Webhook handler failed for ${event.type} (${event.id}):`, err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, row.id));
  return NextResponse.json({ received: true });
}
