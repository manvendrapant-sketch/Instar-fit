import { POST } from './route';
import { requireClientSession } from '@/lib/auth/require-client';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';

jest.mock('@/lib/auth/require-client');
jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');

const SESSION = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

const PAUSED_SUBSCRIPTION = {
  id: 'sub-1',
  clientId: 'client-1',
  offerId: 'offer-1',
  priceId: 'price-1',
  stripeSubscriptionId: 'sub_stripe_1',
  status: 'paused' as const,
  pauseReason: 'vacation',
  pauseResumesAt: new Date('2026-12-01T00:00:00.000Z'),
};

function req() {
  return new Request('http://localhost/api/client/subscriptions/sub-1/resume', { method: 'POST' });
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

beforeEach(() => jest.clearAllMocks());

describe('POST /api/client/subscriptions/[id]/resume', () => {
  it('returns 401 when not authenticated', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the subscription does not belong to this client', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue(undefined)));
    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 when the subscription is not currently paused', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue({ ...PAUSED_SUBSCRIPTION, status: 'active' })));
    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(409);
  });

  it('clears pause_collection via Stripe and syncs the DB row back to active', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue(PAUSED_SUBSCRIPTION)));
    const stripeUpdate = jest.fn().mockResolvedValue({ status: 'active', items: { data: [] }, pause_collection: null });
    (getStripe as jest.Mock).mockReturnValue({ subscriptions: { update: stripeUpdate } });

    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });

    expect(stripeUpdate).toHaveBeenCalledWith('sub_stripe_1', { pause_collection: '' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { subscription: { status: 'active', pauseReason: null, pauseResumesAt: null } },
    });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue(PAUSED_SUBSCRIPTION)));
    (getStripe as jest.Mock).mockReturnValue({ subscriptions: { update: jest.fn().mockRejectedValue(new Error('stripe down')) } });

    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(500);
  });
});
