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
  stripeSubscriptionId: 'sub_stripe_1',
  status: 'active' as const,
};

function req() {
  return new Request('http://localhost/api/client/subscriptions/sub-1/cancel', { method: 'POST' });
}

function baseDb(subscriptionFindFirst: jest.Mock, updateSet: jest.Mock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) })) {
  return {
    query: { subscriptions: { findFirst: subscriptionFindFirst } },
    update: jest.fn().mockReturnValue({ set: updateSet }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/client/subscriptions/[id]/cancel', () => {
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

  it('returns 409 when already canceled', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue({ ...SUBSCRIPTION, status: 'canceled' })));
    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(409);
  });

  it('cancels via Stripe and marks the row canceled', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    const updateSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue(SUBSCRIPTION), updateSet));
    const stripeCancel = jest.fn().mockResolvedValue({});
    (getStripe as jest.Mock).mockReturnValue({ subscriptions: { cancel: stripeCancel } });

    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });

    expect(stripeCancel).toHaveBeenCalledWith('sub_stripe_1');
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'canceled', pauseResumesAt: null, pauseReason: null }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { id: 'sub-1' } });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb(jest.fn().mockResolvedValue(SUBSCRIPTION)));
    (getStripe as jest.Mock).mockReturnValue({ subscriptions: { cancel: jest.fn().mockRejectedValue(new Error('stripe down')) } });

    const res = await POST(req(), { params: Promise.resolve({ id: 'sub-1' }) });
    expect(res.status).toBe(500);
  });
});
