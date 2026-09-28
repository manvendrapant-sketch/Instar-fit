import { POST } from './route';
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

describe('POST /api/coach/connect/dashboard-link', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 422 when payouts are not connected yet', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(undefined));
    const res = await POST();
    expect(res.status).toBe(422);
  });

  it('creates a fresh login link for the connected account', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(ACCOUNT));
    const createLoginLink = jest.fn().mockResolvedValue({ url: 'https://connect.stripe.com/express/acct_1' });
    (getStripe as jest.Mock).mockReturnValue({ accounts: { createLoginLink } });

    const res = await POST();

    expect(createLoginLink).toHaveBeenCalledWith('acct_1');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { url: 'https://connect.stripe.com/express/acct_1' } });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(ACCOUNT));
    (getStripe as jest.Mock).mockReturnValue({ accounts: { createLoginLink: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
