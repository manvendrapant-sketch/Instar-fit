import { POST } from '@/app/api/coach/connect/account-link/route';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const COACH = { id: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes' };

function linkRequest(body: unknown = {}) {
  return new Request('http://localhost/api/coach/connect/account-link', { method: 'POST', body: JSON.stringify(body) });
}

function insertChain(returningResult: unknown[]) {
  const returning = jest.fn().mockResolvedValue(returningResult);
  const values = jest.fn().mockReturnValue({ returning });
  return { values };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/coach/connect/account-link', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(linkRequest());
    expect(res.status).toBe(401);
  });

  it('creates a new Stripe Express account on first call, then an account link', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const accountsCreate = jest.fn().mockResolvedValue({ id: 'acct_1' });
    const accountLinksCreate = jest.fn().mockResolvedValue({ url: 'https://connect.stripe.com/setup/acct_1' });
    (getStripe as jest.Mock).mockReturnValue({ accounts: { create: accountsCreate }, accountLinks: { create: accountLinksCreate } });
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue(COACH) }, connectedAccounts: { findFirst: jest.fn().mockResolvedValue(undefined) } },
      insert: jest.fn().mockReturnValue(insertChain([{ id: 'ca-1', coachId: 'coach-1', stripeAccountId: 'acct_1' }])),
    });

    const res = await POST(linkRequest());

    expect(res.status).toBe(200);
    expect(accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'express', email: 'maya@studio.com' }),
    );
    expect(accountLinksCreate).toHaveBeenCalledWith({
      account: 'acct_1',
      type: 'account_onboarding',
      return_url: 'http://localhost/business',
      refresh_url: 'http://localhost/business',
    });
    await expect(res.json()).resolves.toMatchObject({ data: { url: 'https://connect.stripe.com/setup/acct_1' } });
  });

  it('reuses an existing connected account instead of creating a second one', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const accountsCreate = jest.fn();
    const accountLinksCreate = jest.fn().mockResolvedValue({ url: 'https://connect.stripe.com/setup/acct_1' });
    (getStripe as jest.Mock).mockReturnValue({ accounts: { create: accountsCreate }, accountLinks: { create: accountLinksCreate } });
    (getDb as jest.Mock).mockReturnValue({
      query: {
        coaches: { findFirst: jest.fn().mockResolvedValue(COACH) },
        connectedAccounts: { findFirst: jest.fn().mockResolvedValue({ id: 'ca-1', coachId: 'coach-1', stripeAccountId: 'acct_1' }) },
      },
      insert: jest.fn(),
    });

    const res = await POST(linkRequest({ returnPath: '/business/payouts' }));

    expect(res.status).toBe(200);
    expect(accountsCreate).not.toHaveBeenCalled();
    expect(accountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_1', return_url: 'http://localhost/business/payouts' }),
    );
  });
});
