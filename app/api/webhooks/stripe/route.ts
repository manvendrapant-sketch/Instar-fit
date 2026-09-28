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

  // Everything below touches Postgres. Previously only the handler-dispatch step was wrapped in
  // try/catch — the bookkeeping insert/lookup/update around it were not, so a transient DB error
  // there (a dropped connection, a pooler hiccup under concurrent webhook deliveries, ...) crashed
  // the whole Route Handler uncaught: Next's bare framework 500, no JSON body, nothing for Stripe
  // to show us and nothing telling Stripe *why* to retry differently. Confirmed 2026-09-28 against
  // a real delivery whose "Internal Server Error" response had no body at all — exactly that
  // signature, same class of bug as the very first login/signup 500s this app ever had. Wrapping
  // the whole thing means every failure path now returns real JSON and still asks Stripe to retry.
  try {
    const inserted = await db
      .insert(webhookEvents)
      .values({ stripeEventId: event.id, type: event.type, payload: event as unknown as object })
      .onConflictDoNothing({ target: webhookEvents.stripeEventId })
      .returning({ id: webhookEvents.id, processedAt: webhookEvents.processedAt });

    // A conflict here is normally a genuine duplicate delivery — but if a previous attempt's
    // handler crashed after this row was first inserted and before `processedAt` was ever set, it
    // means Stripe is retrying a delivery we never actually finished. Reprocess it rather than
    // silently dropping it: row existence alone isn't proof the event was handled, only
    // `processedAt` is.
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

    await dispatchWebhookEvent(db, event, new URL(req.url).origin);

    await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, row.id));
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Webhook processing failed for ${event.type} (${event.id}):`, err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
