import { GET } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const PAYMENT = { id: 'pay-1', coachId: 'coach-1', totalAmountCents: 20000, platformFeeCents: 400, currency: 'usd' };

function req(amountCents?: string) {
  const url = amountCents ? `http://localhost/api/coach/payments/pay-1/refund-quote?amountCents=${amountCents}` : 'http://localhost/api/coach/payments/pay-1/refund-quote';
  return new Request(url);
}

function selectChain(rows: unknown[]) {
  return { from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(rows) }) };
}

function mockDb(payment: unknown, refundRows: unknown[] = []) {
  return {
    query: { payments: { findFirst: jest.fn().mockResolvedValue(payment) } },
    select: jest.fn().mockReturnValue(selectChain(refundRows)),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/coach/payments/[id]/refund-quote', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(req('5000'), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 422 when amountCents is missing', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const res = await GET(req(), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(422);
  });

  it('returns 404 when the payment does not belong to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(undefined));
    const res = await GET(req('5000'), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(404);
  });

  it('computes the preview from the payment and any already-succeeded refunds', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(mockDb(PAYMENT, [{ amountCents: 5000 }]));

    const res = await GET(req('5000'), { params: Promise.resolve({ id: 'pay-1' }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { maxRefundableCents: 15000, clientReceivesCents: 5000 },
    });
  });

  it('returns 500 on a DB error', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: {
        payments: {
          findFirst: jest.fn().mockRejectedValue(new Error('db down')),
        },
      },
    });
    const res = await GET(req('5000'), { params: Promise.resolve({ id: 'pay-1' }) });
    expect(res.status).toBe(500);
  });
});
