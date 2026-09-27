import { POST } from './route';
import { requireClientSession } from '@/lib/auth/require-client';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';

jest.mock('@/lib/auth/require-client');
jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');

const SESSION = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

const SUBSCRIPTION = {
  id: 'sub-1',
  clientId: 'client-1',
  offerId: 'offer-1',
  priceId: 'price-1',
  stripeSubscriptionId: 'sub_stripe_1',
  status: 'active' as const,
  pauseReason: null,
  pauseResumesAt: null,
};

function req(body: unknown) {
  return new Request('http://localhost/api/client/subscriptions/sub-1/pause', { method: 'POST', body: JSON.stringify(body) });
}

function updateChain() {
  return { set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) };
}

function baseDb(subscriptionFindFirst: jest.Mock) {
  return {
    query: {
      subscriptions: { findFirst: subscriptionFindFirst },
      offers: { findFirst: jest.fn().mockResolvedValue({ name: 'Monthly Coaching' }) },
      prices: { findFirst: jest.fn().mockResolvedValue({ currency: 'usd', unitAmountCents: 19900, interval: 'month', intervalCount: 1 }) },
    },
    update: jest.fn().mockReturnValue(updateChain()),
  };
}

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

beforeEach(() => jest.clearAllMocks());

describe('POST /api/client/subscriptions/[id]/pause', () => {
  it('returns 401 when not authenticated', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(req({ reason: 'vacation', resumeDate: future }), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 422 for an invalid body', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    const res = await POST(req({ reason: 'because', resumeDate: future }), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(422);
  });

  it('returns 404 when the subscription does not belong to this client', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue(undefined)));
    const res = await POST(req({ reason: 'vacation', resumeDate: future }), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the subscription is already canceled', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue({ ...SUBSCRIPTION, status: 'canceled' })));
    const res = await POST(req({ reason: 'vacation', resumeDate: future }), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(409);
  });

  it('pauses via Stripe, syncs the DB row from the response, and returns the updated summary', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    const { update, ...db } = baseDb(jest.fn().mockResolvedValue(SUBSCRIPTION));
    (getDb as jest.Mock).mockReturnValue({ ...db, update });

    const resumesAtEpoch = Math.floor(new Date(`${future}T00:00:00.000Z`).getTime() / 1000);
    const stripeUpdate = jest.fn().mockResolvedValue({
      status: 'active',
      items: { data: [] },
      pause_collection: { resumes_at: resumesAtEpoch },
    });
    (getStripe as jest.Mock).mockReturnValue({ subscriptions: { update: stripeUpdate } });

    const res = await POST(req({ reason: 'vacation', resumeDate: future }), { params: Promise.resolve({ id: 'sub-1' }) });

    expect(stripeUpdate).toHaveBeenCalledWith('sub_stripe_1', {
      pause_collection: { behavior: 'void', resumes_at: resumesAtEpoch },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { subscription: { status: 'paused', pauseReason: 'vacation', offerName: 'Monthly Coaching' } },
    });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue(SUBSCRIPTION)));
    (getStripe as jest.Mock).mockReturnValue({ subscriptions: { update: jest.fn().mockRejectedValue(new Error('stripe down')) } });

    const res = await POST(req({ reason: 'vacation', resumeDate: future }), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(500);
  });
});
