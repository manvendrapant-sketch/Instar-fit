import { GET } from './route';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const ACCOUNT = { id: 'ca-1', coachId: 'coach-1', stripeAccountId: 'acct_1' };

function mockDb(account: unknown) {
  return { query: { connectedAccounts: { findFirst: jest.fn().mockResolvedValue(account) } } };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/coach/payouts', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 422 when payouts are not connected', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(undefined));
    const res = await GET();
    expect(res.status).toBe(422);
  });

  it('lists payouts live from Stripe, scoped to the connected account', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(ACCOUNT));
    const list = jest.fn().mockResolvedValue({
      data: [{ id: 'po_1', currency: 'usd', amount: 19900, status: 'paid', arrival_date: 1700000000, created: 1699900000 }],
      has_more: true,
    });
    (getStripe as jest.Mock).mockReturnValue({ payouts: { list } });

    const res = await GET();

    expect(list).toHaveBeenCalledWith({ limit: 25 }, { stripeContext: 'acct_1' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { payouts: [{ id: 'po_1', amountCents: 19900, status: 'paid' }], hasMore: true },
    });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(ACCOUNT));
    (getStripe as jest.Mock).mockReturnValue({ payouts: { list: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
