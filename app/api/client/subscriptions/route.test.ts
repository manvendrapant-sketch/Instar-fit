import { GET } from './route';
import { requireClientSession } from '@/lib/auth/require-client';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-client');
jest.mock('@/lib/commerce/db');

const SESSION = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

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

describe('GET /api/client/subscriptions', () => {
  it('returns 401 when not authenticated', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the client subscriptions joined with offer name and price', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(
      mockDb([
        {
          subscription: {
            id: 'sub-1',
            status: 'active',
            currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
            pauseResumesAt: null,
            pauseReason: null,
          },
          offer: { name: 'Monthly Coaching' },
          price: { currency: 'usd', unitAmountCents: 19900, interval: 'month', intervalCount: 1 },
        },
      ]),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: {
        subscriptions: [
          {
            id: 'sub-1',
            offerName: 'Monthly Coaching',
            status: 'active',
            price: { unitAmountCents: 19900 },
          },
        ],
        purchases: [],
      },
    });
  });

  it('returns one-time purchases alongside subscriptions', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(
      mockDb(
        [],
        [
          {
            payment: { id: 'pay-1', currency: 'usd', totalAmountCents: 49900, createdAt: new Date('2026-09-01T00:00:00.000Z') },
            offer: { name: '12-Week Program' },
          },
        ],
      ),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: {
        subscriptions: [],
        purchases: [{ id: 'pay-1', offerName: '12-Week Program', amountCents: 49900 }],
      },
    });
  });

  it('returns 500 on a DB error', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      select: jest.fn().mockImplementation(() => {
        throw new Error('db down');
      }),
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
