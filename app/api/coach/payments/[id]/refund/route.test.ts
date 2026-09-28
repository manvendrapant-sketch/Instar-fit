import Stripe from 'stripe';
import { POST } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const PAYMENT = {
  id: 'pay-1',
  coachId: 'coach-1',
  totalAmountCents: 20000,
  platformFeeCents: 400,
  currency: 'usd',
  stripePaymentIntentId: 'pi_1',
  stripeChargeId: 'ch_1',
};

function req(body: unknown) {
  return new Request('http://localhost/api/coach/payments/pay-1/refund', { method: 'POST', body: JSON.stringify(body) });
}

function selectChain(rows: unknown[]) {
  return { from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(rows) }) };
}

function mockDb(payment: unknown, refundRows: unknown[] = []) {
  return {
    query: { payments: { findFirst: jest.fn().mockResolvedValue(payment) } },
    select: jest.fn().mockReturnValue(selectChain(refundRows)),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/coach/payments/[id]/refund', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ amountCents: 5000 }), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the payment does not belong to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(undefined));
    const res = await POST(req({ amountCents: 5000 }), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 422 when the amount exceeds what is refundable', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(PAYMENT, []));
    const res = await POST(req({ amountCents: 999999 }), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(422);
  });

  it('creates the refund via Stripe with both fee-reversal flags set, preferring payment_intent over charge', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(PAYMENT, []));
    const create = jest.fn().mockResolvedValue({ id: 're_1', status: 'succeeded', amount: 5000 });
    (getStripe as jest.Mock).mockReturnValue({ refunds: { create } });

    const res = await POST(req({ amountCents: 5000, reason: 'Client request' }), { params: Promise.resolve({ id: 'pay-1' }) });

    expect(create).toHaveBeenCalledWith({
      payment_intent: 'pi_1',
      amount: 5000,
      refund_application_fee: true,
      reverse_transfer: true,
      metadata: { reason: 'Client request' },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { id: 're_1', status: 'succeeded', amountCents: 5000 } });
  });

  it('falls back to charge id when there is no payment_intent id', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ ...PAYMENT, stripePaymentIntentId: null }, []));
    const create = jest.fn().mockResolvedValue({ id: 're_1', status: 'succeeded', amount: 5000 });
    (getStripe as jest.Mock).mockReturnValue({ refunds: { create } });

    await POST(req({ amountCents: 5000 }), { params: Promise.resolve({ id: 'pay-1' }) });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ charge: 'ch_1' }));
  });

  it('returns 422 when the payment has no Stripe charge at all', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ ...PAYMENT, stripePaymentIntentId: null, stripeChargeId: null }, []));
    const res = await POST(req({ amountCents: 5000 }), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(422);
  });

  it('returns 500 when Stripe fails with an unexpected (non-request) error', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(PAYMENT, []));
    (getStripe as jest.Mock).mockReturnValue({ refunds: { create: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await POST(req({ amountCents: 5000 }), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(500);
  });

  it('forwards a Stripe invalid-request error (e.g. already refunded) as a 422 with Stripe\'s own message', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(PAYMENT, []));
    const stripeErr = new Stripe.errors.StripeInvalidRequestError({
      message: 'Charge ch_1 has already been refunded.',
      type: 'invalid_request_error',
    });
    (getStripe as jest.Mock).mockReturnValue({ refunds: { create: jest.fn().mockRejectedValue(stripeErr) } });
    const res = await POST(req({ amountCents: 5000 }), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ code: 'REFUND_FAILED', message: 'Charge ch_1 has already been refunded.' });
  });
});
