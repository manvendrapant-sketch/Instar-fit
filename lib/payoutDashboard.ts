import { apiFetch } from './api-client';
import type {
  CoachBalanceResponse,
  CoachPaymentSummary,
  CoachPaymentsResponse,
  CoachPayoutSummary,
  CoachPayoutsResponse,
  PaymentStatus,
  PayoutScheduleResponse,
  PayoutStatus,
} from './commerce/types';

// Payout dashboard (Sprint 5). Everything money-related here is DISPLAYED, never computed: the
// server (Stripe balance/schedule/payouts + our payments table, via /api/coach/balance,
// /api/coach/payout-schedule, /api/coach/payouts, /api/coach/payments) returns every figure,
// including what the coach keeps per payment (netCents). The browser only formats, labels, and
// combines those four separate GETs into one screen — it computes no money itself, only
// `nextPayout` below, which is a plain lookup (soonest not-yet-arrived payout), not a money
// calculation.

export interface NextPayout {
  amountCents: number;
  arrivalDate: string;
}

export interface PayoutDashboardData {
  balance: CoachBalanceResponse;
  schedule: PayoutScheduleResponse;
  payouts: CoachPayoutSummary[];
  payments: CoachPaymentSummary[];
  nextPayout: NextPayout | null;
}

export type DashboardResult = { ok: true; data: PayoutDashboardData } | { ok: false; message: string };

/** The soonest payout that hasn't landed yet (pending or in transit), or null once everything the
 * account has sent has arrived. */
export function findNextPayout(payouts: CoachPayoutSummary[]): NextPayout | null {
  const upcoming = payouts.filter((p) => p.status === 'pending' || p.status === 'in_transit');
  if (upcoming.length === 0) return null;
  const soonest = upcoming.reduce((a, b) => (new Date(a.arrivalDate) < new Date(b.arrivalDate) ? a : b));
  return { amountCents: soonest.amountCents, arrivalDate: soonest.arrivalDate };
}

/**
 * Loads everything the payout dashboard needs, in parallel. Any one of the four failing is a real
 * error for the whole page — unlike an earlier draft of this module, there's no sample-data
 * fallback: all four endpoints are real now, so a failure here means something is actually wrong.
 */
export async function fetchPayoutDashboard(): Promise<DashboardResult> {
  const [balanceRes, scheduleRes, payoutsRes, paymentsRes] = await Promise.all([
    apiFetch<CoachBalanceResponse>('/api/coach/balance'),
    apiFetch<PayoutScheduleResponse>('/api/coach/payout-schedule'),
    apiFetch<CoachPayoutsResponse>('/api/coach/payouts'),
    apiFetch<CoachPaymentsResponse>('/api/coach/payments'),
  ]);

  for (const res of [balanceRes, scheduleRes, payoutsRes, paymentsRes]) {
    if (!res.success) return { ok: false, message: res.message };
  }
  // The loop above already returned on any failure; these re-checks are only so TypeScript
  // narrows each variable's own type (it can't follow that through a loop over an array literal).
  if (!balanceRes.success || !scheduleRes.success || !payoutsRes.success || !paymentsRes.success) {
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }

  const payouts = payoutsRes.data.payouts;
  return {
    ok: true,
    data: {
      balance: balanceRes.data,
      schedule: scheduleRes.data,
      payouts,
      payments: paymentsRes.data.payments,
      nextPayout: findNextPayout(payouts),
    },
  };
}

// ---- Display helpers ---------------------------------------------------------------------------

export const PAYOUT_STATUS: Record<PayoutStatus, { label: string; chip: string }> = {
  paid: { label: 'Paid', chip: 'k-lead' },
  in_transit: { label: 'On its way', chip: 'k-checkin' },
  pending: { label: 'Scheduled', chip: 'k-renew' },
  failed: { label: 'Failed', chip: 'k-money' },
  canceled: { label: 'Canceled', chip: 'k-renew' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; chip: string }> = {
  succeeded: { label: 'Paid', chip: 'k-lead' },
  partially_refunded: { label: 'Part refunded', chip: 'k-quiet' },
  refunded: { label: 'Refunded', chip: 'k-renew' },
  disputed: { label: 'Disputed', chip: 'k-money' },
  failed: { label: 'Failed', chip: 'k-money' },
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Daily", "Every Friday", "Monthly on the 1st", "Manual". */
export function scheduleLabel(s: PayoutScheduleResponse): string {
  switch (s.interval) {
    case 'daily':
      return 'Daily';
    case 'weekly': {
      const day = s.weeklyAnchor && WEEKDAYS.includes(s.weeklyAnchor) ? s.weeklyAnchor : 'monday';
      return `Every ${day[0].toUpperCase()}${day.slice(1)}`;
    }
    case 'monthly':
      return `Monthly on the ${ordinal(s.monthlyAnchor ?? 1)}`;
    case 'manual':
      return 'Manual';
  }
}

/** "Payments become available 2 days after a client pays." */
export function delayLabel(s: PayoutScheduleResponse): string {
  if (s.interval === 'manual') return 'You send payouts yourself from Stripe.';
  const d = s.delayDays;
  return `Payments become available ${d} day${d === 1 ? '' : 's'} after a client pays.`;
}

/** "Sep 28" this year, "Sep 28, 2025" otherwise. */
export function shortDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric', timeZone: 'UTC' });
}

/** "Today", "Tomorrow", "in 3 days", or a date, for the next payout's arrival. */
export function arrivalLabel(iso: string, now: Date = new Date()): string {
  const day = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const diff = Math.round((day(new Date(iso)) - day(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff <= 6) return `In ${diff} days`;
  return shortDate(iso, now);
}

/** Client name, falling back to their email when Stripe has no name for them. */
export function clientLabel(p: Pick<CoachPaymentSummary, 'clientName' | 'clientEmail'>): string {
  return p.clientName?.trim() || p.clientEmail;
}

export function isEmptyDashboard(d: PayoutDashboardData): boolean {
  return d.payments.length === 0 && d.payouts.length === 0 && d.balance.pendingCents === 0 && d.balance.availableCents === 0;
}
