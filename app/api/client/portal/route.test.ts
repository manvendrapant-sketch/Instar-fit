import { POST } from './route';
import { requireClientSession } from '@/lib/auth/require-client';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';

jest.mock('@/lib/auth/require-client');
jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');

const SESSION = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

function req() {
  return new Request('http://localhost/api/client/portal', { method: 'POST' });
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/client/portal', () => {
  it('returns 401 when not authenticated', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('returns 422 when the client has no Stripe customer id yet', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { clients: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1', stripeCustomerId: null }) } },
    });

    const res = await POST(req());
    expect(res.status).toBe(422);
  });

  it('creates a billing portal session scoped to the coach handle return URL', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { clients: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1', stripeCustomerId: 'cus_1' }) } },
    });
    const create = jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/session/xyz' });
    (getStripe as jest.Mock).mockReturnValue({ billingPortal: { sessions: { create } } });

    const res = await POST(req());

    expect(create).toHaveBeenCalledWith({ customer: 'cus_1', return_url: 'http://localhost/maya-reyes/account' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { url: 'https://billing.stripe.com/session/xyz' } });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { clients: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1', stripeCustomerId: 'cus_1' }) } },
    });
    (getStripe as jest.Mock).mockReturnValue({ billingPortal: { sessions: { create: jest.fn().mockRejectedValue(new Error('down')) } } });

    const res = await POST(req());
    expect(res.status).toBe(500);
  });
});
