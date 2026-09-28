import { apiFetch } from './api-client';
import { formatMoney, parsePriceToCents } from './offers';
import type { CoachPaymentSummary, RefundPaymentRequest, RefundPaymentResponse, RefundQuoteResponse } from './commerce/types';

// Refunds (Sprint 5): a coach refunds all or part of a client payment from the payout dashboard.
// Every figure comes from the server: GET .../refund-quote says what the client gets back, how
// much of Instar's fee is returned and what comes out of the coach's balance (Decisions.md,
// 2026-09-28: the fee is reversed in proportion). The browser never does that maths, and never
// even works out "how much is left to refund" itself: a full refund asks the quote for the whole
// payment and the server caps it at what's left.

export const refundQuotePath = (paymentId: string, amountCents: number) =>
  `/api/coach/payments/${encodeURIComponent(paymentId)}/refund-quote?amountCents=${amountCents}`;
export const refundPath = (paymentId: string) => `/api/coach/payments/${encodeURIComponent(paymentId)}/refund`;

/** Stripe's own refund reasons. The server stores the value on the refund's metadata. */
export type RefundReason = 'requested_by_customer' | 'duplicate' | 'fraudulent';

export const REFUND_REASONS: Record<RefundReason, string> = {
  requested_by_customer: 'Client asked for a refund',
  duplicate: 'They were charged twice',
  fraudulent: 'The payment looks fraudulent',
};

// ---- Form ----------------------------------------------------------------------------------

export type RefundMode = 'full' | 'partial';
export interface RefundForm {
  mode: RefundMode;
  /** The partial-amount box's raw text. */
  amountInput: string;
  reason: RefundReason | '';
}
export type RefundErrors = Partial<Record<'amount' | 'reason', string>>;

/** A refund can start from a paid or part-refunded payment; refunded, disputed and failed ones can't. */
export function isRefundable(p: Pick<CoachPaymentSummary, 'status'>): boolean {
  return p.status === 'succeeded' || p.status === 'partially_refunded';
}

/**
 * The amount to ask the quote for, in cents. A full refund asks for the whole payment (the server
 * caps it at what's left); a partial one is whatever the coach typed, or null if it doesn't parse.
 */
export function requestedAmountCents(form: RefundForm, payment: Pick<CoachPaymentSummary, 'totalAmountCents'>): number | null {
  return form.mode === 'full' ? payment.totalAmountCents : parsePriceToCents(form.amountInput);
}

/** Checks the form alone. Whether the amount fits what's left is the server quote's call. */
export function validateRefund(form: RefundForm): RefundErrors {
  const errors: RefundErrors = {};
  if (form.mode === 'partial') {
    const cents = parsePriceToCents(form.amountInput);
    if (!form.amountInput.trim()) errors.amount = 'Enter how much to refund.';
    else if (cents == null) errors.amount = 'Enter an amount like 50 or 49.99.';
    else if (cents < 1) errors.amount = 'Refund at least $0.01.';
  }
  if (!form.reason) errors.reason = 'Pick a reason.';
  return errors;
}

/**
 * Reads the quote against what was asked for. The server caps `clientReceivesCents` at what's left
 * to refund, so for a partial refund a smaller figure means the coach asked for too much.
 */
export function checkQuote(form: RefundForm, requestedCents: number, quote: RefundQuoteResponse): RefundErrors {
  if (quote.maxRefundableCents <= 0) return { amount: 'This payment has already been fully refunded.' };
  if (form.mode === 'partial' && requestedCents > quote.maxRefundableCents) {
    return { amount: `You can refund up to ${formatMoney(quote.maxRefundableCents)}.` };
  }
  return {};
}

export function toRefundRequest(form: RefundForm, quote: RefundQuoteResponse): RefundPaymentRequest {
  return { amountCents: quote.clientReceivesCents, ...(form.reason ? { reason: form.reason } : {}) };
}

// ---- Calls ----------------------------------------------------------------------------------

export type QuoteResult = { ok: true; quote: RefundQuoteResponse } | { ok: false; message: string; fieldErrors: RefundErrors };
export type RefundResult = { ok: true; refund: RefundPaymentResponse } | { ok: false; message: string; fieldErrors: RefundErrors };

function mapFields(fields?: Record<string, string>): RefundErrors {
  const errors: RefundErrors = {};
  if (fields?.amountCents) errors.amount = fields.amountCents;
  if (fields?.reason) errors.reason = fields.reason;
  return errors;
}

export async function fetchRefundQuote(paymentId: string, amountCents: number): Promise<QuoteResult> {
  const res = await apiFetch<RefundQuoteResponse>(refundQuotePath(paymentId, amountCents));
  if (res.success) return { ok: true, quote: res.data };
  return { ok: false, message: res.message, fieldErrors: mapFields(res.fields) };
}

/**
 * Starts the refund on Stripe. The payment row itself only changes once Stripe confirms it (the
 * `charge.refunded` webhook writes the refund), so the caller shows it as processing until then.
 */
export async function createRefund(paymentId: string, request: RefundPaymentRequest): Promise<RefundResult> {
  const res = await apiFetch<RefundPaymentResponse>(refundPath(paymentId), { method: 'POST', body: request });
  if (res.success) return { ok: true, refund: res.data };
  return { ok: false, message: res.message, fieldErrors: mapFields(res.fields) };
}
