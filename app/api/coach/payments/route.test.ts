import { GET } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function paymentsChain(rows: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ orderBy });
  const leftJoin = jest.fn().mockReturnValue({ where });
  const innerJoin = jest.fn().mockReturnValue({ leftJoin });
  return { from: jest.fn().mockReturnValue({ innerJoin }) };
}

function refundsChain(rows: unknown[]) {
  const where = jest.fn().mockResolvedValue(rows);
  return { from: jest.fn().mockReturnValue({ where }) };
}

function mockDb(paymentRows: unknown[], refundRows: unknown[] = []) {
  const select = jest.fn().mockReturnValueOnce(paymentsChain(paymentRows)).mockReturnValueOnce(refundsChain(refundRows));
  return { select };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/coach/payments', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns payments with refunded amounts joined in', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(
      mockDb(
        [
          {
            payment: { id: 'pay-1', currency: 'usd', totalAmountCents: 19900, status: 'succeeded', createdAt: new Date('2026-09-01T00:00:00.000Z') },
            client: { email: 'a@b.com', name: 'Ada' },
            offer: { name: 'Monthly Coaching' },
          },
        ],
        [{ paymentId: 'pay-1', amountCents: 5000 }],
      ),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { payments: [{ id: 'pay-1', clientName: 'Ada', offerName: 'Monthly Coaching', refundedAmountCents: 5000 }] },
    });
  });

  it('falls back to "Deleted offer" when the offer no longer exists', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(
      mockDb([
        {
          payment: { id: 'pay-1', currency: 'usd', totalAmountCents: 4900, status: 'succeeded', createdAt: new Date() },
          client: { email: 'a@b.com', name: null },
          offer: null,
        },
      ]),
    );

    const res = await GET();
    await expect(res.json()).resolves.toMatchObject({ data: { payments: [{ offerName: 'Deleted offer' }] } });
  });

  it('skips the refunds query entirely when there are no payments', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const db = mockDb([]);
    (getDb as jest.Mock).mockReturnValue(db);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.select).toHaveBeenCalledTimes(1);
    await expect(res.json()).resolves.toMatchObject({ data: { payments: [] } });
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
