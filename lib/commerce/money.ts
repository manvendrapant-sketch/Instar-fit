import 'server-only';

/**
 * The one place fees are computed. Never re-derive these numbers in a component or on the
 * client — every screen displays exactly what this (or an API route calling this) returns.
 *
 * Decided 2026-09-26:
 * - Charge type: destination charges with `on_behalf_of` the coach's connected account (the
 *   client's card statement shows the coach's business name; Stripe routes disputes to the
 *   platform first).
 * - Client-facing fee: a flat "Service fee" line, never a labeled surcharge (avoids card-network
 *   surcharge rules and per-state caps/disclosure requirements, and works on debit cards).
 * - Platform take rate: 2% of the offer's base price, taken as `application_fee_amount` on the
 *   Stripe charge — it is a share of what the coach would otherwise receive, not an extra charge
 *   to the client.
 */

/** Basis points, not a percentage — 200 = 2.00%. Overridable per-environment for experimentation. */
export const PLATFORM_TAKE_RATE_BPS = envInt('PLATFORM_TAKE_RATE_BPS', 200);

/** Approximates card processing cost passed through to the client as the disclosed service fee. */
export const SERVICE_FEE_RATE_BPS = envInt('SERVICE_FEE_RATE_BPS', 300);

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${key} must be a non-negative integer (basis points), got "${raw}"`);
  }
  return n;
}

function bpsOf(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / 10_000);
}

export interface MoneyBreakdown {
  currency: string;
  /** The offer's own price. */
  baseAmountCents: number;
  /** Disclosed to the client at checkout as "Service fee". */
  serviceFeeCents: number;
  /** baseAmountCents + serviceFeeCents — what the client's card is actually charged. */
  totalAmountCents: number;
  /** Instar's take, as `application_fee_amount` — a share of baseAmountCents, not added on top. */
  platformFeeCents: number;
}

export function computeCheckoutBreakdown(baseAmountCents: number, currency = 'usd'): MoneyBreakdown {
  if (!Number.isInteger(baseAmountCents) || baseAmountCents < 0) {
    throw new Error(`baseAmountCents must be a non-negative integer (cents), got ${baseAmountCents}`);
  }
  const serviceFeeCents = bpsOf(baseAmountCents, SERVICE_FEE_RATE_BPS);
  const platformFeeCents = bpsOf(baseAmountCents, PLATFORM_TAKE_RATE_BPS);
  return {
    currency,
    baseAmountCents,
    serviceFeeCents,
    totalAmountCents: baseAmountCents + serviceFeeCents,
    platformFeeCents,
  };
}

/** Formats integer cents as a display string, e.g. 19900 -> "$199.00". USD only for now. */
export function formatCents(amountCents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    amountCents / 100,
  );
}
