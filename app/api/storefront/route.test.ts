import { GET, PATCH } from '@/app/api/storefront/route';
import { getDb } from '@/lib/commerce/db';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const COACH = { id: 'coach-1', handle: 'maya-reyes', published: false };
const READY_ACCOUNT = { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, requirementsDue: [] };

function selectActiveOffersChain(rows: unknown[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const from = jest.fn().mockReturnValue({ where });
  return { from };
}

function mockDb({
  coach = COACH,
  account,
  activeOffers = [{ id: 'offer-1' }],
}: {
  coach?: typeof COACH;
  account?: typeof READY_ACCOUNT;
  activeOffers?: unknown[];
}) {
  return {
    query: {
      coaches: { findFirst: jest.fn().mockResolvedValue(coach) },
      connectedAccounts: { findFirst: jest.fn().mockResolvedValue(account) },
    },
    select: jest.fn().mockReturnValue(selectActiveOffersChain(activeOffers)),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) }),
  };
}

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/storefront', { method: 'PATCH', body: JSON.stringify(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/storefront', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('reports canPublish=true once Connect is ready and there is at least one active offer', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ account: READY_ACCOUNT }));

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { handle: 'maya-reyes', published: false, canPublish: true, connectStatus: 'ready', publicUrl: '/maya-reyes' },
    });
  });

  it('reports canPublish=false when payouts are not ready yet', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ account: undefined }));

    const res = await GET();
    await expect(res.json()).resolves.toMatchObject({ data: { canPublish: false, connectStatus: 'not_started' } });
  });
});

describe('PATCH /api/storefront', () => {
  it('returns 422 NOT_READY when trying to publish before the readiness gate passes', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ account: undefined }));

    const res = await PATCH(patchRequest({ published: true }));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ code: 'NOT_READY' });
  });

  it('publishes once the readiness gate passes', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ account: READY_ACCOUNT }));

    const res = await PATCH(patchRequest({ published: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ message: "You're live.", data: { published: true } });
  });

  it('always allows unpublishing, even without the readiness gate', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb({ coach: { ...COACH, published: true }, account: undefined }));

    const res = await PATCH(patchRequest({ published: false }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { published: false } });
  });
});
