import type { ApiResult } from './api-client';
import { formatMoney, parsePriceToCents } from './offers';
import type { CoachPaymentSummary } from './payoutDashboard';

// Refunds (Sprint 5): a coach refunds all or part of a client payment from the payout dashboard.
// What the client gets back and what comes out of the coach's balance depend on decisions still
// open with Manvendra (does Instar return its 2%? is the service fee refunded?), so the server's
// quote decides and the browser only displays it.

// ---- PROPOSED contract (move to lib/commerce/types.ts once agreed, like PayoutDashboardResponse) ----

/** Stripe's own refund reasons, so the server can pass them straight through. */
export type RefundReason = 'requested_by_customer' | 'duplicate' | 'fraudulent';

/** GET /api/coach/payments/[id]/refund-quote?amountCents= (proposed). */
export interface RefundQuoteResponse {
  currency: string;
  /** The amount being refunded, as requested. */
  amountCents: number;
  /** What lands back on the client's card. */
  clientReceivesCents: number;
  /** What comes out of the coach's Instar balance for it. */
  fromYourBalanceCents: number;
  /** Plain-English lines the server wants shown, e.g. "Instar's 2% fee is returned to you." */
  notes: string[];
}

/** POST /api/coach/payments/[id]/refund (proposed). */
export interface CreateRefundRequest {
  amountCents: number;
  reason: RefundReason;
  /** Optional private note for the coach's records, never sent to the client. */
  note: string | null;
}

export interface CreateRefundResponse {
  /** The payment as it stands after the refund, to replace the row in place. */
  payment: CoachPaymentSummary;
  refund: { id: string; amountCents: number; status: 'pending' | 'succeeded' | 'failed' };
}

export const refundQuotePath = (paymentId: string, amountCents: number) =>
  `/api/coach/payments/${encodeURIComponent(paymentId)}/refund-quote?amountCents=${amountCents}`;
export const refundPath = (paymentId: string) => `/api/coach/payments/${encodeURIComponent(paymentId)}/refund`;

export const REFUND_REASONS: Record<RefundReason, string> = {
  requested_by_customer: 'Client asked for a refund',
  duplicate: 'They were charged twice',
  fraudulent: 'The payment looks fraudulent',
};

export const NOTE_MAX = 200;

// ---- Validation ----------------------------------------------------------------------------

export type RefundMode = 'full' | 'partial';
export interface RefundForm {
  mode: RefundMode;
  /** The partial-amount box's raw text. */
  amountInput: string;
  reason: RefundReason | '';
  note: string;
}
export type RefundErrors = Partial<Record<'amount' | 'reason' | 'note', string>>;

export function isRefundable(p: Pick<CoachPaymentSummary, 'refundableCents'>): boolean {
  return p.refundableCents > 0;
}

/** The amount this form asks to refund, in cents, or null if the partial box doesn't parse. */
export function refundAmountCents(form: RefundForm, payment: Pick<CoachPaymentSummary, 'refundableCents'>): number | null {
  return form.mode === 'full' ? payment.refundableCents : parsePriceToCents(form.amountInput);
}

export function validateRefund(form: RefundForm, payment: Pick<CoachPaymentSummary, 'refundableCents'>): RefundErrors {
  const errors: RefundErrors = {};
  if (form.mode === 'partial') {
    const cents = parsePriceToCents(form.amountInput);
    if (!form.amountInput.trim()) errors.amount = 'Enter how much to refund.';
    else if (cents == null) errors.amount = 'Enter an amount like 50 or 49.99.';
    else if (cents < 1) errors.amount = 'Refund at least $0.01.';
    else if (cents > payment.refundableCents) errors.amount = `You can refund up to ${formatMoney(payment.refundableCents)}.`;
  }
  if (!form.reason) errors.reason = 'Pick a reason.';
  if (form.note.length > NOTE_MAX) errors.note = `Keep the note under ${NOTE_MAX} characters.`;
  return errors;
}

export function toRefundRequest(form: RefundForm, amountCents: number): CreateRefundRequest {
  return { amountCents, reason: form.reason as RefundReason, note: form.note.trim() || null };
}

// ---- Calls ----------------------------------------------------------------------------------

export type QuoteResult = { ok: true; quote: RefundQuoteResponse; sample: boolean } | { ok: false; message: string };
export type RefundResult =
  | { ok: true; result: CreateRefundResponse; sample: boolean }
  | { ok: false; message: string; fieldErrors: RefundErrors };

const GENERIC = 'Something went wrong. Please try again.';

/**
 * Same rule as the payout dashboard: only an HTTP 404 (route not built yet) falls back to sample
 * data; any other failure is a real error, so nobody believes a refund happened when it didn't.
 */
export async function fetchRefundQuote(payment: CoachPaymentSummary, amountCents: number, fetchImpl: typeof fetch = fetch): Promise<QuoteResult> {
  try {
    const res = await fetchImpl(refundQuotePath(payment.id, amountCents));
    if (res.status === 404) return { ok: true, quote: sampleQuote(payment, amountCents), sample: true };
    const body = (await res.json()) as ApiResult<RefundQuoteResponse>;
    return body.success ? { ok: true, quote: body.data, sample: false } : { ok: false, message: body.message };
  } catch {
    return { ok: false, message: GENERIC };
  }
}

export async function createRefund(payment: CoachPaymentSummary, request: CreateRefundRequest, fetchImpl: typeof fetch = fetch): Promise<RefundResult> {
  try {
    const res = await fetchImpl(refundPath(payment.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (res.status === 404) return { ok: true, result: sampleRefund(payment, request.amountCents), sample: true };
    const body = (await res.json()) as ApiResult<CreateRefundResponse>;
    if (body.success) return { ok: true, result: body.data, sample: false };
    const f = body.fields ?? {};
    const fieldErrors: RefundErrors = {};
    if (f.amountCents) fieldErrors.amount = f.amountCents;
    if (f.reason) fieldErrors.reason = f.reason;
    if (f.note) fieldErrors.note = f.note;
    return { ok: false, message: body.message, fieldErrors };
  } catch {
    return { ok: false, message: GENERIC, fieldErrors: {} };
  }
}

// ---- Sample data (prototype only, always shown under a "sample" label) -----------------------
// Deliberately does no fee maths: it echoes the requested amount, because the real split between
// client, coach and Instar is exactly what the server's quote is for.

export function sampleQuote(payment: Pick<CoachPaymentSummary, 'currency'>, amountCents: number): RefundQuoteResponse {
  return {
    currency: payment.currency,
    amountCents,
    clientReceivesCents: amountCents,
    fromYourBalanceCents: amountCents,
    notes: ['Sample figures. The real split (fees, service fee) comes from Instar once refunds are connected.'],
  };
}

export function sampleRefund(payment: CoachPaymentSummary, amountCents: number): CreateRefundResponse {
  const refundedCents = payment.refundedCents + amountCents;
  const refundableCents = Math.max(0, payment.refundableCents - amountCents);
  return {
    payment: {
      ...payment,
      refundedCents,
      refundableCents,
      netCents: refundableCents === 0 ? 0 : payment.netCents,
      status: refundableCents === 0 ? 'refunded' : 'partially_refunded',
    },
    refund: { id: `re_sample_${payment.id}`, amountCents, status: 'pending' },
  };
}
