import type { CoachPaymentSummary, RefundQuoteResponse } from './commerce/types';
import {
  checkQuote,
  createRefund,
  fetchRefundQuote,
  isRefundable,
  refundPath,
  refundQuotePath,
  REFUND_REASONS,
  requestedAmountCents,
  toRefundRequest,
  validateRefund,
  type RefundForm,
} from './refunds';

const paid: CoachPaymentSummary = {
  id: 'pay_1',
  clientName: 'Leah Kim',
  clientEmail: 'leah@example.com',
  offerName: '1:1 Coaching',
  currency: 'usd',
  totalAmountCents: 20_497,
  netCents: 19_502,
  refundedAmountCents: 0,
  status: 'succeeded',
  createdAt: '2026-09-20T12:00:00.000Z',
};
const quote = (over: Partial<RefundQuoteResponse> = {}): RefundQuoteResponse => ({
  currency: 'usd',
  maxRefundableCents: 20_497,
  clientReceivesCents: 20_497,
  platformFeeReversedCents: 398,
  coachBalanceImpactCents: 20_099,
  ...over,
});
const form = (over: Partial<RefundForm> = {}): RefundForm => ({ mode: 'full', amountInput: '', reason: 'requested_by_customer', ...over });

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
const respond = (body: unknown) => fetchMock.mockResolvedValueOnce({ json: async () => body } as Response);

describe('isRefundable', () => {
  it('allows paid and part-refunded payments only', () => {
    expect(isRefundable({ status: 'succeeded' })).toBe(true);
    expect(isRefundable({ status: 'partially_refunded' })).toBe(true);
    expect(isRefundable({ status: 'refunded' })).toBe(false);
    expect(isRefundable({ status: 'disputed' })).toBe(false);
    expect(isRefundable({ status: 'failed' })).toBe(false);
  });
});

describe('requestedAmountCents', () => {
  it('asks for the whole payment on a full refund and lets the server cap it', () => {
    const partlyRefunded: CoachPaymentSummary = { ...paid, refundedAmountCents: 5_000 };
    expect(requestedAmountCents(form(), partlyRefunded)).toBe(20_497);
  });
  it('parses the partial box, or returns null', () => {
    expect(requestedAmountCents(form({ mode: 'partial', amountInput: '49.99' }), paid)).toBe(4_999);
    expect(requestedAmountCents(form({ mode: 'partial', amountInput: 'abc' }), paid)).toBeNull();
  });
});

describe('validateRefund', () => {
  it('accepts a full refund with a reason', () => {
    expect(validateRefund(form())).toEqual({});
  });
  it('requires a reason', () => {
    expect(validateRefund(form({ reason: '' })).reason).toBeDefined();
  });
  it('checks the partial amount parses and is positive', () => {
    expect(validateRefund(form({ mode: 'partial', amountInput: '' })).amount).toMatch(/how much/);
    expect(validateRefund(form({ mode: 'partial', amountInput: '5.555' })).amount).toMatch(/like 50/);
    expect(validateRefund(form({ mode: 'partial', amountInput: '0' })).amount).toMatch(/at least/);
    expect(validateRefund(form({ mode: 'partial', amountInput: '50' }))).toEqual({});
  });
  it('has a label for every reason', () => {
    expect(Object.keys(REFUND_REASONS)).toEqual(['requested_by_customer', 'duplicate', 'fraudulent']);
  });
});

describe('checkQuote', () => {
  it('passes a quote that covers what was asked', () => {
    expect(checkQuote(form(), 20_497, quote())).toEqual({});
    expect(checkQuote(form({ mode: 'partial', amountInput: '50' }), 5_000, quote({ clientReceivesCents: 5_000 }))).toEqual({});
  });
  it('flags a partial amount over what is left, using the server figure', () => {
    const q = quote({ maxRefundableCents: 3_000, clientReceivesCents: 3_000 });
    expect(checkQuote(form({ mode: 'partial', amountInput: '50' }), 5_000, q).amount).toBe('You can refund up to $30.');
  });
  it('lets a full refund take whatever is left', () => {
    expect(checkQuote(form(), 20_497, quote({ maxRefundableCents: 3_000, clientReceivesCents: 3_000 }))).toEqual({});
  });
  it('flags a payment with nothing left', () => {
    expect(checkQuote(form(), 20_497, quote({ maxRefundableCents: 0, clientReceivesCents: 0 })).amount).toMatch(/already been fully refunded/);
  });
});

describe('toRefundRequest', () => {
  it('sends the server-quoted amount and the reason', () => {
    expect(toRefundRequest(form(), quote({ clientReceivesCents: 3_000 }))).toEqual({ amountCents: 3_000, reason: 'requested_by_customer' });
  });
});

describe('fetchRefundQuote', () => {
  it('calls the quote route and returns the server figures', async () => {
    respond({ success: true, message: 'ok', data: quote() });
    await expect(fetchRefundQuote('pay_1', 20_497)).resolves.toEqual({ ok: true, quote: quote() });
    expect(fetchMock.mock.calls[0][0]).toBe(refundQuotePath('pay_1', 20_497));
    expect(refundQuotePath('pay/1', 5)).toBe('/api/coach/payments/pay%2F1/refund-quote?amountCents=5');
  });
  it('maps field errors and passes other failures through', async () => {
    respond({ success: false, code: 'VALIDATION_ERROR', message: 'Fix it', fields: { amountCents: 'Required.' } });
    await expect(fetchRefundQuote('pay_1', 1)).resolves.toEqual({ ok: false, message: 'Fix it', fieldErrors: { amount: 'Required.' } });
    respond({ success: false, code: 'NOT_FOUND', message: 'Payment not found.' });
    await expect(fetchRefundQuote('pay_1', 1)).resolves.toEqual({ ok: false, message: 'Payment not found.', fieldErrors: {} });
  });
  it('returns an error, never sample figures, when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const r = await fetchRefundQuote('pay_1', 1);
    expect(r.ok).toBe(false);
  });
});

describe('createRefund', () => {
  it('POSTs the request and returns Stripe’s refund', async () => {
    respond({ success: true, message: 'Refund started.', data: { id: 're_1', status: 'pending', amountCents: 3_000 } });
    const r = await createRefund('pay_1', { amountCents: 3_000, reason: 'duplicate' });
    expect(r).toEqual({ ok: true, refund: { id: 're_1', status: 'pending', amountCents: 3_000 } });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe(refundPath('pay_1'));
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ amountCents: 3_000, reason: 'duplicate' });
  });
  it('maps the server’s amount error onto the form', async () => {
    respond({ success: false, code: 'VALIDATION_ERROR', message: 'Fix it', fields: { amountCents: 'Too much.' } });
    await expect(createRefund('pay_1', { amountCents: 99_999 })).resolves.toEqual({ ok: false, message: 'Fix it', fieldErrors: { amount: 'Too much.' } });
  });
});
