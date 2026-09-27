import { GET } from './route';
import { requireClientSession } from '@/lib/auth/require-client';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-client');
jest.mock('@/lib/commerce/db');

const SESSION = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

function selectChain(rows: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ orderBy });
  const innerJoin2 = jest.fn().mockReturnValue({ where });
  const innerJoin1 = jest.fn().mockReturnValue({ innerJoin: innerJoin2 });
  const from = jest.fn().mockReturnValue({ innerJoin: innerJoin1 });
  return { select: jest.fn().mockReturnValue({ from }) };
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
      selectChain([
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
