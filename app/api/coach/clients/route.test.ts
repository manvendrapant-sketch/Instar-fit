import { GET } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function selectChain(rows: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ orderBy });
  const innerJoin2 = jest.fn().mockReturnValue({ where });
  const innerJoin1 = jest.fn().mockReturnValue({ innerJoin: innerJoin2 });
  const from = jest.fn().mockReturnValue({ innerJoin: innerJoin1 });
  return { select: jest.fn().mockReturnValue({ from }) };
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
      selectChain([
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
