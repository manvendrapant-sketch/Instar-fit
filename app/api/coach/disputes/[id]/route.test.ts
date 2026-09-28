import { GET } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { findOwnDispute } from '@/lib/commerce/disputes';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');
jest.mock('@/lib/stripe/client');
jest.mock('@/lib/commerce/disputes', () => ({
  ...jest.requireActual('@/lib/commerce/disputes'),
  findOwnDispute: jest.fn(),
}));

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const ROW = {
  dispute: {
    id: 'dis-1',
    paymentId: 'pay-1',
    amountCents: 19900,
    reason: 'fraudulent',
    status: 'needs_response',
    stripeDisputeId: 'dp_1',
    evidenceDueBy: new Date('2026-10-01T00:00:00.000Z'),
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
  },
  payment: { currency: 'usd' },
  client: { email: 'a@b.com', name: 'Ada' },
  offer: { name: 'Monthly Coaching' },
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/coach/disputes/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the dispute does not belong to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(404);
  });

  it('combines the DB row with a live Stripe read for evidence and due-by details', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    const retrieve = jest.fn().mockResolvedValue({
      evidence: { customer_name: 'Ada' },
      evidence_details: { submission_count: 1, past_due: false },
    });
    (getStripe as jest.Mock).mockReturnValue({ disputes: { retrieve } });

    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'dis-1' }) });

    expect(retrieve).toHaveBeenCalledWith('dp_1');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: {
        id: 'dis-1',
        evidence: { customerName: 'Ada' },
        acceptedEvidenceFields: expect.arrayContaining(['customerPurchaseIp']),
        submissionCount: 1,
        pastDue: false,
      },
    });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    (getStripe as jest.Mock).mockReturnValue({ disputes: { retrieve: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(500);
  });
});
