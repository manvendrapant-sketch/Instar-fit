import 'server-only';
import type Stripe from 'stripe';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import type { subscriptions } from './schema';
import type { ClientSubscriptionSummary, CoachClientSummary, OfferPrice, PauseReason, PauseSubscriptionRequest, SubscriptionStatus } from './types';

type Db = PostgresJsDatabase<typeof schema>;

/** Scoped to this client's own id so one client can never touch another's subscription by
 * guessing its uuid — a mismatch reads identically to "doesn't exist". Mirrors findOwnOffer. */
export async function findOwnClientSubscription(db: Db, clientId: string, id: string) {
  return db.query.subscriptions.findFirst({
    where: (s, { eq: eqCol, and: andCol }) => andCol(eqCol(s.id, id), eqCol(s.clientId, clientId)),
  });
}

export const PAUSE_REASONS: PauseReason[] = ['vacation', 'injury', 'other'];

/**
 * Stripe's own Subscription.status has two values our coarser DB enum doesn't: `incomplete_expired`
 * (mapped to `canceled` — it never became payable) and `unpaid` (mapped to `past_due` — the closest
 * of our six states for "billing is broken and Stripe has given up retrying").
 */
export function mapSubscriptionStatus(status: string): SubscriptionStatus {
  if (status === 'incomplete_expired') return 'canceled';
  if (status === 'unpaid') return 'past_due';
  const known: SubscriptionStatus[] = ['incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled'];
  return (known as string[]).includes(status) ? (status as SubscriptionStatus) : 'incomplete';
}

export interface SubscriptionSyncFields {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  pauseResumesAt: Date | null;
  pauseReason: string | null;
}

/**
 * The one place a Stripe Subscription object is turned into our own row's fields — used both by
 * the `customer.subscription.*` webhook handler and by the pause/resume/cancel routes (which sync
 * optimistically from the Stripe API response rather than waiting for that webhook to arrive).
 * `existingPauseReason` is ours alone — Stripe has no concept of *why* a subscription is paused —
 * so it's only ever carried forward while `pause_collection` is still set, never invented here.
 *
 * Important Stripe quirk (confirmed against this pinned SDK's own .d.ts, not assumed): setting
 * `pause_collection` deliberately does NOT change `Subscription.status` — a real Stripe `paused`
 * status means something else entirely (a trial that ended with no payment method on file). So
 * our own `status: 'paused'` is derived here, not read off Stripe's `status` field: whenever
 * `pause_collection` is active we report `paused` regardless of what Stripe's own status says
 * underneath (it stays `active`), and fall back to the real mapped status once it clears —
 * whether that's this app clearing it (resume/cancel) or Stripe itself doing so automatically at
 * `resumes_at`.
 */
export function subscriptionSyncFields(sub: Stripe.Subscription, existingPauseReason: string | null): SubscriptionSyncFields {
  const periodEnd = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;
  const resumesAt = sub.pause_collection?.resumes_at;
  const pauseResumesAt = resumesAt ? new Date(resumesAt * 1000) : null;
  const pauseReason = pauseResumesAt ? existingPauseReason : null;
  const status = pauseResumesAt ? 'paused' : mapSubscriptionStatus(sub.status);
  return { status, currentPeriodEnd, pauseResumesAt, pauseReason };
}

export function toClientSubscriptionSummary(
  row: typeof subscriptions.$inferSelect,
  offerName: string,
  price: OfferPrice,
): ClientSubscriptionSummary {
  return {
    id: row.id,
    offerName,
    price,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
    pauseResumesAt: row.pauseResumesAt ? row.pauseResumesAt.toISOString() : null,
    pauseReason: (row.pauseReason as PauseReason | null) ?? null,
  };
}

export function toCoachClientSummary(
  row: typeof subscriptions.$inferSelect,
  offerName: string,
  clientId: string,
  clientEmail: string,
  clientName: string | null,
): CoachClientSummary {
  return {
    clientId,
    clientEmail,
    clientName,
    subscriptionId: row.id,
    offerName,
    status: row.status,
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
    pauseResumesAt: row.pauseResumesAt ? row.pauseResumesAt.toISOString() : null,
    pauseReason: (row.pauseReason as PauseReason | null) ?? null,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A resume date more than a year out is almost certainly a mistake, not a real vacation. */
const MAX_PAUSE_DAYS = 366;

/** `resumeDate` must be a plain yyyy-mm-dd, strictly in the future, and not absurdly far out. */
export function validatePauseInput(body: unknown): { errors: Record<string, string> } | { value: PauseSubscriptionRequest } {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const reason = PAUSE_REASONS.includes(b.reason as PauseReason) ? (b.reason as PauseReason) : undefined;
  if (!reason) errors.reason = 'Choose a reason: vacation, injury, or other.';

  let resumeDate = '';
  if (typeof b.resumeDate !== 'string' || !DATE_RE.test(b.resumeDate)) {
    errors.resumeDate = 'Enter a valid date (yyyy-mm-dd).';
  } else {
    const parsed = new Date(`${b.resumeDate}T00:00:00.000Z`);
    const now = new Date();
    const maxDate = new Date(now.getTime() + MAX_PAUSE_DAYS * 24 * 60 * 60 * 1000);
    if (Number.isNaN(parsed.getTime()) || parsed <= now) {
      errors.resumeDate = 'Pick a resume date in the future.';
    } else if (parsed > maxDate) {
      errors.resumeDate = 'Pick a resume date within the next year.';
    } else {
      resumeDate = b.resumeDate;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { value: { reason: reason as PauseReason, resumeDate } };
}
