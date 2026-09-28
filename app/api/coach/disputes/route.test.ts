import { GET } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function selectChain(rows: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ orderBy });
  const node: { where: jest.Mock; innerJoin: jest.Mock; leftJoin: jest.Mock } = {
    where,
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
  };
  node.innerJoin.mockReturnValue(node);
  node.leftJoin.mockReturnValue(node);
  return { from: jest.fn().mockReturnValue(node) };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/coach/disputes', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns disputes scoped to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue(
        selectChain([
          {
            dispute: {
              id: 'dis-1',
              paymentId: 'pay-1',
              amountCents: 19900,
              reason: 'fraudulent',
              status: 'needs_response',
              evidenceDueBy: new Date('2026-10-01T00:00:00.000Z'),
              createdAt: new Date('2026-09-20T00:00:00.000Z'),
            },
            payment: { currency: 'usd' },
            client: { email: 'a@b.com', name: 'Ada' },
            offer: { name: 'Monthly Coaching' },
          },
        ]),
      ),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { disputes: [{ id: 'dis-1', clientName: 'Ada', offerName: 'Monthly Coaching', status: 'needs_response' }] },
    });
  });

  it('returns 500 on a DB error', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      select: jest.fn().mockImplementation(() => {
        throw new Error('db down');
      }),
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
