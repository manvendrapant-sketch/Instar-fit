import type { ApiResult } from './api-client';

// Payout dashboard (Sprint 5). Everything money-related here is DISPLAYED, never computed: the
// server (Stripe balance + our payments table) returns every figure, including what the coach
// receives per payment. The browser only formats and labels.

// ---- PROPOSED contract ---------------------------------------------------------------------
// Not in lib/commerce/types.ts yet: that file is the shared contract and changes to it are agreed
// with Manvendra first. Move these there (unchanged, or as agreed) once
// GET /api/coach/payouts/dashboard exists. Status strings mirror the existing Postgres enums
// payout_status and payment_status in lib/commerce/schema.ts.

export type PayoutStatusName = 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled';
export type PaymentStatusName = 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'disputed';
export type PayoutInterval = 'manual' | 'daily' | 'weekly' | 'monthly';

export interface PayoutBalance {
  currency: string;
  /** Paid by clients, not yet available to pay out (Stripe's `pending` balance). */
  pendingCents: number;
  /** Available and waiting for the next payout (Stripe's `available` balance). */
  availableCents: number;
  /** What the coach received this calendar month, after Instar's fee and refunds. */
  earnedThisMonthCents: number;
  earnedLastMonthCents: number;
  /** The next scheduled payout, if Stripe has one. */
  nextPayout: { amountCents: number; arrivalDate: string } | null;
}

export interface PayoutSchedule {
  interval: PayoutInterval;
  /** Days between a payment and its money becoming available (Stripe's delay_days). */
  delayDays: number;
  /** For weekly: e.g. "friday". */
  weeklyAnchor: string | null;
  /** For monthly: day of month, 1–31. */
  monthlyAnchor: number | null;
}

export interface PayoutSummary {
  id: string;
  amountCents: number;
  currency: string;
  status: PayoutStatusName;
  /** When it lands (or landed) in the bank. */
  arrivalDate: string | null;
  createdAt: string;
}

export interface CoachPaymentSummary {
  id: string;
  clientName: string | null;
  clientEmail: string;
  offerName: string;
  /** What the client's card was charged (price + service fee). */
  amountCents: number;
  /** What the coach keeps from it after Instar's fee and any refunds (0 once fully refunded). Server-computed. */
  netCents: number;
  refundedCents: number;
  /** How much can still be refunded (0 when fully refunded, disputed or failed). Server-computed. */
  refundableCents: number;
  currency: string;
  status: PaymentStatusName;
  paidAt: string;
}

/** GET /api/coach/payouts/dashboard (proposed): one call so the page loads fast on a phone. */
export interface PayoutDashboardResponse {
  balance: PayoutBalance;
  schedule: PayoutSchedule;
  /** Most recent first, up to 10. */
  payouts: PayoutSummary[];
  /** Most recent first, up to 20. */
  payments: CoachPaymentSummary[];
}

export const PAYOUT_DASHBOARD_ENDPOINT = '/api/coach/payouts/dashboard';

// ---- Loading ---------------------------------------------------------------------------------

export type DashboardResult =
  | { ok: true; data: PayoutDashboardResponse; sample: false }
  | { ok: true; data: PayoutDashboardResponse; sample: true }
  | { ok: false; message: string };

/**
 * Loads the dashboard. Until the backend route exists, an HTTP 404 (the route isn't there yet)
 * falls back to clearly labelled sample data so the screen can be reviewed. Anything else that
 * fails, including a dropped connection, is a real error and says so, so a coach is never shown
 * sample money because their network blipped.
 */
export async function fetchPayoutDashboard(fetchImpl: typeof fetch = fetch): Promise<DashboardResult> {
  try {
    const res = await fetchImpl(PAYOUT_DASHBOARD_ENDPOINT);
    if (res.status === 404) return { ok: true, data: SAMPLE_DASHBOARD, sample: true };
    const body = (await res.json()) as ApiResult<PayoutDashboardResponse>;
    if (body.success) return { ok: true, data: body.data, sample: false };
    return { ok: false, message: body.message };
  } catch {
    return { ok: false, message: 'Something went wrong. Please try again.' };
  }
}

// ---- Display helpers ---------------------------------------------------------------------------

export const PAYOUT_STATUS: Record<PayoutStatusName, { label: string; chip: string }> = {
  paid: { label: 'Paid', chip: 'k-lead' },
  in_transit: { label: 'On its way', chip: 'k-checkin' },
  pending: { label: 'Scheduled', chip: 'k-renew' },
  failed: { label: 'Failed', chip: 'k-money' },
  canceled: { label: 'Canceled', chip: 'k-renew' },
};

export const PAYMENT_STATUS: Record<PaymentStatusName, { label: string; chip: string }> = {
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
export function scheduleLabel(s: PayoutSchedule): string {
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
export function delayLabel(s: PayoutSchedule): string {
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

export function isEmptyDashboard(d: PayoutDashboardResponse): boolean {
  return d.payments.length === 0 && d.payouts.length === 0 && d.balance.pendingCents === 0 && d.balance.availableCents === 0;
}

// ---- Sample data (prototype only) ---------------------------------------------------------------
// Shown, always with a visible "sample data" banner, only while the endpoint doesn't exist.

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

export const SAMPLE_DASHBOARD: PayoutDashboardResponse = {
  balance: {
    currency: 'usd',
    pendingCents: 38_220,
    availableCents: 21_040,
    earnedThisMonthCents: 164_332,
    earnedLastMonthCents: 142_110,
    nextPayout: { amountCents: 21_040, arrivalDate: daysFromNow(2) },
  },
  schedule: { interval: 'daily', delayDays: 2, weeklyAnchor: null, monthlyAnchor: null },
  payouts: [
    { id: 'po_s1', amountCents: 19_502, currency: 'usd', status: 'in_transit', arrivalDate: daysFromNow(1), createdAt: daysFromNow(-1) },
    { id: 'po_s2', amountCents: 48_902, currency: 'usd', status: 'paid', arrivalDate: daysFromNow(-3), createdAt: daysFromNow(-5) },
    { id: 'po_s3', amountCents: 19_502, currency: 'usd', status: 'paid', arrivalDate: daysFromNow(-9), createdAt: daysFromNow(-11) },
  ],
  payments: [
    { id: 'pay_s1', clientName: 'Leah Kim', clientEmail: 'leah@example.com', offerName: '1:1 Coaching', amountCents: 20_497, netCents: 19_502, refundedCents: 0, refundableCents: 20_497, currency: 'usd', status: 'succeeded', paidAt: daysFromNow(0) },
    { id: 'pay_s2', clientName: 'Jake Thompson', clientEmail: 'jake@example.com', offerName: '12-week strength block', amountCents: 51_397, netCents: 48_902, refundedCents: 0, refundableCents: 51_397, currency: 'usd', status: 'succeeded', paidAt: daysFromNow(-4) },
    { id: 'pay_s3', clientName: null, clientEmail: 'priya.s@example.com', offerName: 'Discovery call', amountCents: 5_047, netCents: 0, refundedCents: 5_047, refundableCents: 0, currency: 'usd', status: 'refunded', paidAt: daysFromNow(-6) },
    { id: 'pay_s4', clientName: 'Sam Ortiz', clientEmail: 'sam@example.com', offerName: '1:1 Coaching', amountCents: 20_497, netCents: 19_502, refundedCents: 0, refundableCents: 0, currency: 'usd', status: 'disputed', paidAt: daysFromNow(-12) },
  ],
};
