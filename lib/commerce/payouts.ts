import 'server-only';
import type Stripe from 'stripe';
import type { CoachBalanceResponse, CoachPayoutSummary, PayoutInterval, PayoutScheduleResponse, PayoutStatus } from './types';

/**
 * Balance and payout data are read live from Stripe Connect, never cached locally — see
 * Decisions.md's "Sprint 5 decisions" entry for why (matches the workplan's own "payout numbers
 * match the Stripe dashboard" bar, and sidesteps needing a separate Connect-scoped webhook
 * registration that reading live avoids entirely).
 */

const KNOWN_PAYOUT_STATUSES: PayoutStatus[] = ['paid', 'pending', 'in_transit', 'canceled', 'failed'];

function mapPayoutStatus(status: string): PayoutStatus {
  return (KNOWN_PAYOUT_STATUSES as string[]).includes(status) ? (status as PayoutStatus) : 'pending';
}

const KNOWN_INTERVALS: PayoutInterval[] = ['daily', 'weekly', 'monthly', 'manual'];

function mapPayoutInterval(interval: string | undefined): PayoutInterval {
  return interval && (KNOWN_INTERVALS as string[]).includes(interval) ? (interval as PayoutInterval) : 'daily';
}

/** This app only ever deals in USD today (see money.ts) — the one place that assumption is baked
 * into a balance read, picking which currency's figures to surface from Stripe's per-currency arrays. */
export const DEFAULT_CURRENCY = 'usd';

export function toPayoutScheduleResponse(schedule: Stripe.Account.Settings.Payouts.Schedule | undefined): PayoutScheduleResponse {
  return {
    interval: mapPayoutInterval(schedule?.interval),
    delayDays: typeof schedule?.delay_days === 'number' ? schedule.delay_days : 2,
    weeklyAnchor: schedule?.weekly_anchor ?? null,
    monthlyAnchor: typeof schedule?.monthly_anchor === 'number' ? schedule.monthly_anchor : null,
  };
}

export function toCoachBalanceResponse(
  balance: Stripe.Balance,
  currency: string,
  earnedThisMonthCents: number,
  earnedLastMonthCents: number,
): CoachBalanceResponse {
  const availableCents = balance.available.find((b) => b.currency === currency)?.amount ?? 0;
  const pendingCents = balance.pending.find((b) => b.currency === currency)?.amount ?? 0;
  return { currency, availableCents, pendingCents, earnedThisMonthCents, earnedLastMonthCents };
}

export function toCoachPayoutSummary(payout: Stripe.Payout): CoachPayoutSummary {
  return {
    id: payout.id,
    currency: payout.currency,
    amountCents: payout.amount,
    status: mapPayoutStatus(payout.status),
    arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
    createdAt: new Date(payout.created * 1000).toISOString(),
  };
}

/** [start, end) bounds of a calendar month, UTC — `monthsAgo: 0` is the current month, `1` the
 * one before it. Used to sum "earned this/last month" from `payments`. */
export function monthRangeUtc(monthsAgo: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1));
  return { start, end };
}
