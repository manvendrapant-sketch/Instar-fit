import { PATCH } from '@/app/api/offers/reorder/route';
import { getDb } from '@/lib/commerce/db';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function reorderRequest(body: unknown) {
  return new Request('http://localhost/api/offers/reorder', { method: 'PATCH', body: JSON.stringify(body) });
}

function selectIdsChain(ids: string[]) {
  const where = jest.fn().mockResolvedValue(ids.map((id) => ({ id })));
  const from = jest.fn().mockReturnValue({ where });
  return { from };
}

function mockTransaction() {
  const txWhere = jest.fn().mockResolvedValue(undefined);
  const txUpdate = jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: txWhere }) });
  const transaction = jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<void>) => cb({ update: txUpdate }));
  return { transaction, txUpdate };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PATCH /api/offers/reorder', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(reorderRequest({ orderedIds: ['a'] }));
    expect(res.status).toBe(401);
  });

  it('returns 422 for a non-array body', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const res = await PATCH(reorderRequest({ orderedIds: 'nope' }));
    expect(res.status).toBe(422);
  });

  it('returns 422 when orderedIds is not exactly the coach’s own offer ids', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const select = jest.fn().mockReturnValue(selectIdsChain(['offer-1', 'offer-2']));
    (getDb as jest.Mock).mockReturnValue({ select });

    const res = await PATCH(reorderRequest({ orderedIds: ['offer-1', 'someone-elses-offer'] }));
    expect(res.status).toBe(422);
  });

  it('reorders by writing each offer’s new position in a transaction', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const select = jest.fn().mockReturnValue(selectIdsChain(['offer-1', 'offer-2']));
    const { transaction, txUpdate } = mockTransaction();
    (getDb as jest.Mock).mockReturnValue({ select, transaction });

    const res = await PATCH(reorderRequest({ orderedIds: ['offer-2', 'offer-1'] }));

    expect(res.status).toBe(200);
    expect(txUpdate).toHaveBeenCalledTimes(2);
    await expect(res.json()).resolves.toMatchObject({ data: { orderedIds: ['offer-2', 'offer-1'] } });
  });
});
