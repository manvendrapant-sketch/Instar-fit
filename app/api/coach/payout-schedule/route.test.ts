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

describe('GET /api/coach/payout-schedule', () => {
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

  it('reads the schedule from the Stripe account settings', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(ACCOUNT));
    const retrieve = jest.fn().mockResolvedValue({ settings: { payouts: { schedule: { interval: 'weekly', delay_days: 4 } } } });
    (getStripe as jest.Mock).mockReturnValue({ accounts: { retrieve } });

    const res = await GET();

    expect(retrieve).toHaveBeenCalledWith('acct_1');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { interval: 'weekly', delayDays: 4 } });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(ACCOUNT));
    (getStripe as jest.Mock).mockReturnValue({ accounts: { retrieve: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
