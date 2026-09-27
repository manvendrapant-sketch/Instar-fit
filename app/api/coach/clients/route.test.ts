import { GET } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

/** Supports any number of chained `.innerJoin(...)` calls before `.where(...).orderBy(...)`. */
function selectChain(rows: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(rows);
  const node: { where: jest.Mock; innerJoin: jest.Mock } = {
    where: jest.fn().mockReturnValue({ orderBy }),
    innerJoin: jest.fn(),
  };
  node.innerJoin.mockReturnValue(node);
  return { from: jest.fn().mockReturnValue(node) };
}

/** The route runs two `db.select(...)` queries in parallel: subscriptions, then purchases. */
function mockDb(subscriptionRows: unknown[], purchaseRows: unknown[] = []) {
  const select = jest.fn().mockReturnValueOnce(selectChain(subscriptionRows)).mockReturnValueOnce(selectChain(purchaseRows));
  return { select };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/coach/clients', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns one row per subscription, scoped to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(
      mockDb([
        {
          subscription: { id: 'sub-1', status: 'past_due', currentPeriodEnd: null, pauseResumesAt: null, pauseReason: null },
          offer: { name: 'Monthly Coaching' },
          client: { id: 'client-1', email: 'a@b.com', name: 'Ada' },
        },
      ]),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: {
        clients: [
          { clientId: 'client-1', clientEmail: 'a@b.com', clientName: 'Ada', subscriptionId: 'sub-1', offerName: 'Monthly Coaching', status: 'past_due' },
        ],
        purchases: [],
      },
    });
  });

  it('returns one-time purchases alongside subscriptions, scoped to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(
      mockDb(
        [],
        [
          {
            payment: { id: 'pay-1', currency: 'usd', totalAmountCents: 49900, createdAt: new Date('2026-09-01T00:00:00.000Z') },
            offer: { name: '12-Week Program' },
            client: { id: 'client-1', email: 'a@b.com', name: 'Ada' },
          },
        ],
      ),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: {
        clients: [],
        purchases: [{ id: 'pay-1', clientId: 'client-1', clientEmail: 'a@b.com', offerName: '12-Week Program', amountCents: 49900 }],
      },
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
