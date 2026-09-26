import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/client';
import { getDb } from '@/lib/commerce/db';
import { webhookEvents } from '@/lib/commerce/schema';

// Stripe signs the raw body; Next.js must not parse it first.
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

  // Dedupe on Stripe's own event id. A retried delivery hits the unique index and no-ops.
  const inserted = await getDb()
    .insert(webhookEvents)
    .values({ stripeEventId: event.id, type: event.type, payload: event as unknown as object })
    .onConflictDoNothing({ target: webhookEvents.stripeEventId })
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    // Already recorded — still 200 so Stripe doesn't keep retrying.
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Sprint 1 scope ends at "store it, verify it, dedupe it". Per-event-type handling
  // (account.updated, invoice.payment_failed, etc.) lands in Sprints 2-5.

  return NextResponse.json({ received: true });
}
