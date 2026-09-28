import { SAMPLE_DASHBOARD, type CoachPaymentSummary } from './payoutDashboard';
import {
  createRefund,
  fetchRefundQuote,
  isRefundable,
  NOTE_MAX,
  refundAmountCents,
  refundPath,
  refundQuotePath,
  REFUND_REASONS,
  sampleRefund,
  toRefundRequest,
  validateRefund,
  type RefundForm,
} from './refunds';

const paid: CoachPaymentSummary = SAMPLE_DASHBOARD.payments[0]; // $204.97, nothing refunded yet
const form = (over: Partial<RefundForm> = {}): RefundForm => ({ mode: 'full', amountInput: '', reason: 'requested_by_customer', note: '', ...over });
const res = (status: number, body: unknown) => jest.fn(async () => ({ status, json: async () => body }) as unknown as Response);

describe('refundability', () => {
  it('follows the server-provided refundable amount', () => {
    expect(isRefundable({ refundableCents: 1 })).toBe(true);
    expect(isRefundable({ refundableCents: 0 })).toBe(false);
    expect(SAMPLE_DASHBOARD.payments.filter(isRefundable).map((p) => p.status)).toEqual(['succeeded', 'succeeded']);
  });
});

describe('validateRefund', () => {
  it('accepts a full refund with a reason', () => {
    expect(validateRefund(form(), paid)).toEqual({});
    expect(refundAmountCents(form(), paid)).toBe(paid.refundableCents);
  });

  it('requires a reason', () => {
    expect(validateRefund(form({ reason: '' }), paid).reason).toBeDefined();
  });

  it('checks the partial amount against what can still be refunded', () => {
    expect(validateRefund(form({ mode: 'partial', amountInput: '' }), paid).amount).toMatch(/how much/);
    expect(validateRefund(form({ mode: 'partial', amountInput: 'abc' }), paid).amount).toMatch(/like 50/);
    expect(validateRefund(form({ mode: 'partial', amountInput: '0' }), paid).amount).toMatch(/at least/);
    expect(validateRefund(form({ mode: 'partial', amountInput: '204.98' }), paid).amount).toBe('You can refund up to $204.97.');
    expect(validateRefund(form({ mode: 'partial', amountInput: '204.97' }), paid)).toEqual({});
    expect(refundAmountCents(form({ mode: 'partial', amountInput: '50' }), paid)).toBe(5000);
  });

  it('limits the note', () => {
    expect(validateRefund(form({ note: 'a'.repeat(NOTE_MAX + 1) }), paid).note).toBeDefined();
  });

  it('builds the request with a trimmed note or null', () => {
    expect(toRefundRequest(form({ note: '  ' }), 100)).toEqual({ amountCents: 100, reason: 'requested_by_customer', note: null });
    expect(toRefundRequest(form({ note: ' Moved away ' }), 100).note).toBe('Moved away');
    expect(Object.keys(REFUND_REASONS)).toEqual(['requested_by_customer', 'duplicate', 'fraudulent']);
  });
});

describe('fetchRefundQuote', () => {
  const quote = { currency: 'usd', amountCents: 5000, clientReceivesCents: 5000, fromYourBalanceCents: 4900, notes: [] };

  it('calls the quote route with the amount', async () => {
    const f = res(200, { success: true, message: 'ok', data: quote });
    await expect(fetchRefundQuote(paid, 5000, f)).resolves.toEqual({ ok: true, quote, sample: false });
    expect(f).toHaveBeenCalledWith(refundQuotePath(paid.id, 5000));
    expect(refundQuotePath('a b', 1)).toBe('/api/coach/payments/a%20b/refund-quote?amountCents=1');
  });

  it('uses a labelled sample only on 404, and errors otherwise', async () => {
    const sample = await fetchRefundQuote(paid, 5000, res(404, {}));
    expect(sample).toMatchObject({ ok: true, sample: true, quote: { amountCents: 5000 } });
    await expect(fetchRefundQuote(paid, 5000, res(500, { success: false, code: 'X', message: 'Nope' }))).resolves.toEqual({ ok: false, message: 'Nope' });
    await expect(fetchRefundQuote(paid, 5000, jest.fn(async () => { throw new Error('offline'); }))).resolves.toMatchObject({ ok: false });
  });
});

describe('createRefund', () => {
  it('posts the request and returns the updated payment', async () => {
    const data = { payment: { ...paid, status: 'refunded' }, refund: { id: 're_1', amountCents: 100, status: 'succeeded' } };
    const f = res(200, { success: true, message: 'ok', data });
    const req = { amountCents: 100, reason: 'duplicate' as const, note: null };
    await expect(createRefund(paid, req, f)).resolves.toEqual({ ok: true, result: data, sample: false });
    expect(f).toHaveBeenCalledWith(refundPath(paid.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
  });

  it('maps the API field errors onto the form', async () => {
    const f = res(422, { success: false, code: 'VALIDATION', message: 'Check the form', fields: { amountCents: 'Too much', reason: 'Bad' } });
    await expect(createRefund(paid, { amountCents: 1, reason: 'duplicate', note: null }, f)).resolves.toEqual({
      ok: false,
      message: 'Check the form',
      fieldErrors: { amount: 'Too much', reason: 'Bad' },
    });
  });

  it('never pretends a refund happened when the call failed', async () => {
    const r = await createRefund(paid, { amountCents: 1, reason: 'duplicate', note: null }, jest.fn(async () => { throw new Error('x'); }));
    expect(r.ok).toBe(false);
  });

  it('falls back to a labelled sample result on 404', async () => {
    const r = await createRefund(paid, { amountCents: 5000, reason: 'duplicate', note: null }, res(404, {}));
    expect(r).toMatchObject({ ok: true, sample: true, result: { payment: { status: 'partially_refunded', refundedCents: 5000 } } });
  });
});

describe('sampleRefund', () => {
  it('marks a payment part or fully refunded', () => {
    expect(sampleRefund(paid, 5000).payment).toMatchObject({ status: 'partially_refunded', refundableCents: paid.refundableCents - 5000 });
    expect(sampleRefund(paid, paid.refundableCents).payment).toMatchObject({ status: 'refunded', refundableCents: 0, netCents: 0 });
  });
});
