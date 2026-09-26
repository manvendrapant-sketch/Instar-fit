import { GET } from '@/app/api/coach/onboarding-status/route';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

const CACHED_ACCOUNT = {
  id: 'ca-1',
  coachId: 'coach-1',
  stripeAccountId: 'acct_1',
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirementsDue: [] as string[],
};

function updateChain() {
  return { set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) };
}

function mockDb(account: unknown, update = jest.fn().mockReturnValue(updateChain())) {
  return { query: { connectedAccounts: { findFirst: jest.fn().mockResolvedValue(account) } }, update };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/coach/onboarding-status', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns not_started when no connected_accounts row exists, without calling Stripe', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(undefined));
    const accountsRetrieve = jest.fn();
    (getStripe as jest.Mock).mockReturnValue({ accounts: { retrieve: accountsRetrieve } });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { status: 'not_started', chargesEnabled: false, payoutsEnabled: false, requirementsDue: [] },
    });
    expect(accountsRetrieve).not.toHaveBeenCalled();
  });

  it("syncs live flags from Stripe and updates the cached row when they've changed", async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const update = jest.fn().mockReturnValue(updateChain());
    (getDb as jest.Mock).mockReturnValue(mockDb(CACHED_ACCOUNT, update));
    (getStripe as jest.Mock).mockReturnValue({
      accounts: {
        retrieve: jest.fn().mockResolvedValue({
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: { currently_due: [] },
        }),
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { status: 'ready', chargesEnabled: true, payoutsEnabled: true, requirementsDue: [] },
    });
    expect(update).toHaveBeenCalled();
  });

  it('skips the DB write when the live Stripe flags match the cached row', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const update = jest.fn().mockReturnValue(updateChain());
    (getDb as jest.Mock).mockReturnValue(mockDb(CACHED_ACCOUNT, update));
    (getStripe as jest.Mock).mockReturnValue({
      accounts: {
        retrieve: jest.fn().mockResolvedValue({
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          requirements: { currently_due: [] },
        }),
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it('falls back to the cached row instead of failing when the Stripe sync itself errors', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ ...CACHED_ACCOUNT, detailsSubmitted: true }));
    (getStripe as jest.Mock).mockReturnValue({ accounts: { retrieve: jest.fn().mockRejectedValue(new Error('down')) } });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { status: 'pending_review' } });
  });
});
