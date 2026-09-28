import 'server-only';
import type { RefundQuoteResponse, RefundStatus } from './types';

const KNOWN_STATUSES: RefundStatus[] = ['pending', 'succeeded', 'failed'];

/**
 * Stripe's real `Refund.status` has two values our narrower DB enum doesn't: `requires_action`
 * (an in-progress state for payment methods needing an extra step — treated as `pending`) and
 * `canceled` (the refund itself was canceled before completing, so the money was never actually
 * returned — treated as `failed`).
 */
export function mapRefundStatus(status: string | null | undefined): RefundStatus {
  if (status === 'requires_action') return 'pending';
  if (status === 'canceled') return 'failed';
  return (KNOWN_STATUSES as string[]).includes(status ?? '') ? (status as RefundStatus) : 'pending';
}

export interface PaymentForRefund {
  totalAmountCents: number;
  platformFeeCents: number;
  currency: string;
}

/**
 * Mirrors exactly what Stripe's own `refund_application_fee` + `reverse_transfer` will do on the
 * real refund call (see Decisions.md's Sprint 5 entry) — Stripe has no "preview a refund"
 * endpoint, so this recomputes the same proportional math ourselves, the same way `money.ts`
 * is the one place checkout fees are computed.
 *
 * "Full refund" here means this refund, combined with whatever was already refunded, reaches the
 * payment's full total — not just that this one call's amount alone equals the total — since a
 * coach can refund in more than one partial step and the last one should still reverse exactly
 * what's left, not a rounded-down fraction of it.
 */
export function computeRefundPreview(
  payment: PaymentForRefund,
  requestedAmountCents: number,
  alreadyRefundedCents: number,
): RefundQuoteResponse {
  const maxRefundableCents = Math.max(0, payment.totalAmountCents - alreadyRefundedCents);
  const clientReceivesCents = Math.min(Math.max(0, requestedAmountCents), maxRefundableCents);
  const isFullRefund = alreadyRefundedCents + clientReceivesCents >= payment.totalAmountCents;

  const platformFeeReversedCents = isFullRefund
    ? payment.platformFeeCents
    : Math.round((payment.platformFeeCents * clientReceivesCents) / payment.totalAmountCents);

  // What actually transferred to the coach's connected account, ignoring Stripe's own card
  // processing cost (not tracked anywhere in this schema, same approximation money.ts already
  // makes for the subscription service-fee case).
  const transferredCents = payment.totalAmountCents - payment.platformFeeCents;
  const coachBalanceImpactCents = isFullRefund
    ? transferredCents
    : Math.round((transferredCents * clientReceivesCents) / payment.totalAmountCents);

  return {
    currency: payment.currency,
    maxRefundableCents,
    clientReceivesCents,
    platformFeeReversedCents,
    coachBalanceImpactCents,
  };
}

/** `amountCents` must be a positive integer, no larger than what's left to refund. */
export function validateRefundAmount(
  rawAmountCents: unknown,
  maxRefundableCents: number,
): { errors: Record<string, string> } | { value: number } {
  if (typeof rawAmountCents !== 'number' || !Number.isInteger(rawAmountCents) || rawAmountCents <= 0) {
    return { errors: { amountCents: 'Enter a refund amount greater than $0.' } };
  }
  if (rawAmountCents > maxRefundableCents) {
    return { errors: { amountCents: 'That is more than what is left to refund on this payment.' } };
  }
  return { value: rawAmountCents };
}
