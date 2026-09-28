import { GET } from './route';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const ACCOUNT = { id: 'ca-1', coachId: 'coach-1', stripeAccountId: 'acct_1' };

function mockDb(account: unknown, monthPayments: unknown[] = []) {
  return {
    query: {
      connectedAccounts: { findFirst: jest.fn().mockResolvedValue(account) },
      payments: { findMany: jest.fn().mockResolvedValue(monthPayments) },
    },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/coach/balance', () => {
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

  it('combines a live Stripe balance read with this month\'s revenue from our own payments', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(
      mockDb(ACCOUNT, [{ totalAmountCents: 10000 }, { totalAmountCents: 5000 }]),
    );
    const retrieve = jest.fn().mockResolvedValue({
      available: [{ amount: 20000, currency: 'usd' }],
      pending: [{ amount: 5000, currency: 'usd' }],
    });
    (getStripe as jest.Mock).mockReturnValue({ balance: { retrieve } });

    const res = await GET();

    expect(retrieve).toHaveBeenCalledWith({}, { stripeContext: 'acct_1' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { currency: 'usd', availableCents: 20000, pendingCents: 5000, revenueThisMonthCents: 15000 },
    });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(ACCOUNT));
    (getStripe as jest.Mock).mockReturnValue({ balance: { retrieve: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
