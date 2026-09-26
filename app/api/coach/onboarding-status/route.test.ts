import { GET } from '@/app/api/coach/onboarding-status/route';
import { getDb } from '@/lib/commerce/db';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/coach/onboarding-status', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns not_started when no connected_accounts row exists', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { connectedAccounts: { findFirst: jest.fn().mockResolvedValue(undefined) } },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { status: 'not_started', chargesEnabled: false, payoutsEnabled: false, requirementsDue: [] },
    });
  });

  it('returns ready with the account’s flags once charges and payouts are both enabled', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: {
        connectedAccounts: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, requirementsDue: [] }),
        },
      },
    });

    const res = await GET();
    await expect(res.json()).resolves.toMatchObject({
      data: { status: 'ready', chargesEnabled: true, payoutsEnabled: true },
    });
  });
});
