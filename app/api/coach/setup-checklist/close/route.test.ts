import { POST } from './route';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/db');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function updateChain() {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  return { set, where };
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/coach/setup-checklist/close', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('sets setupChecklistClosedAt on first call and returns it', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const { set } = updateChain();
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue({ id: 'coach-1', setupChecklistClosedAt: null }) } },
      update: jest.fn().mockReturnValue({ set }),
    });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ setupChecklistClosedAt: expect.any(Date) }));
    const json = await res.json();
    expect(json.data.setupChecklistClosedAt).toEqual(expect.any(String));
  });

  it('is idempotent: a second call never overwrites the original close time', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const alreadyClosedAt = new Date('2026-09-01T00:00:00.000Z');
    const update = jest.fn();
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue({ id: 'coach-1', setupChecklistClosedAt: alreadyClosedAt }) } },
      update,
    });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.setupChecklistClosedAt).toBe(alreadyClosedAt.toISOString());
  });

  it('returns 500 when the database throws', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockRejectedValue(new Error('down')) } },
    });

    const res = await POST();
    expect(res.status).toBe(500);
  });
});
