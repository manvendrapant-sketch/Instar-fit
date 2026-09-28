import { POST } from './route';
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
const ROW = { dispute: { id: 'dis-1', stripeDisputeId: 'dp_1' }, payment: {}, client: {}, offer: null };

function fileRequest(file?: File) {
  const form = new FormData();
  if (file) form.set('file', file);
  return new Request('http://localhost/api/coach/disputes/dis-1/files', { method: 'POST', body: form });
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/coach/disputes/[id]/files', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(fileRequest(new File(['x'], 'a.png')), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the dispute does not belong to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(null);
    const res = await POST(fileRequest(new File(['x'], 'a.png')), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 422 when no file is provided', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    const res = await POST(fileRequest(), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(422);
  });

  it('uploads the file to Stripe with purpose dispute_evidence and returns its file id', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    const create = jest.fn().mockResolvedValue({ id: 'file_123' });
    (getStripe as jest.Mock).mockReturnValue({ files: { create } });

    const res = await POST(fileRequest(new File(['hello'], 'receipt.png', { type: 'image/png' })), {
      params: Promise.resolve({ id: 'dis-1' }),
    });

    expect(create).toHaveBeenCalledWith({
      file: { data: expect.any(Buffer), name: 'receipt.png', type: 'image/png' },
      purpose: 'dispute_evidence',
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { fileId: 'file_123' } });
  });

  it('returns 500 when Stripe fails', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({});
    (findOwnDispute as jest.Mock).mockResolvedValue(ROW);
    (getStripe as jest.Mock).mockReturnValue({ files: { create: jest.fn().mockRejectedValue(new Error('down')) } });
    const res = await POST(fileRequest(new File(['x'], 'a.png')), { params: Promise.resolve({ id: 'dis-1' }) });
    expect(res.status).toBe(500);
  });
});
