import { PATCH, POST } from './route';
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
    evidenceDueBy: null,
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
  },
  payment: { currency: 'usd' },
  client: { email: 'a@b.com', name: 'Ada' },
  offer: { name: 'Monthly Coaching' },
};

function req(body: unknown) {
  return new Request('http://localhost/api/coach/disputes/dis-1/evidence', { method: 'PATCH', body: JSON.stringify(body) });
}

beforeEach(() => jest.clearAllMocks());

describe('PATCH /api/coach/disputes/[id]/evidence (save draft)', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(req({ customerName: 'Ada' }), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the dispute does not belong to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(req({ customerName: 'Ada' }), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(404);
  });

  it('saves with submit:false so nothing finalizes early', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    const update = jest.fn().mockResolvedValue({ evidence: { customer_name: 'Ada' }, evidence_details: { submission_count: 0, past_due: false } });
    (getStripe as jest.Mock).mockReturnValue({ disputes: { update } });

    const res = await PATCH(req({ customerName: 'Ada' }), { params: Promise.resolve({ id: 'dis-1' }) });

    expect(update).toHaveBeenCalledWith('dp_1', { evidence: { customer_name: 'Ada' }, submit: false });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ message: 'Draft saved.', data: { evidence: { customerName: 'Ada' } } });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    (getStripe as jest.Mock).mockReturnValue({ disputes: { update: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await PATCH(req({ customerName: 'Ada' }), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/coach/disputes/[id]/evidence (submit)', () => {
  it('submits with submit:true', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    const update = jest.fn().mockResolvedValue({ evidence: {}, evidence_details: { submission_count: 1, past_due: false } });
    (getStripe as jest.Mock).mockReturnValue({ disputes: { update } });

    const res = await POST(req({ customerName: 'Ada' }), { params: Promise.resolve({ id: 'dis-1' }) });

    expect(update).toHaveBeenCalledWith('dp_1', { evidence: { customer_name: 'Ada' }, submit: true });
    await expect(res.json()).resolves.toMatchObject({ message: 'Evidence submitted.' });
  });
});
