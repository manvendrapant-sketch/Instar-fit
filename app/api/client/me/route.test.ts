import { GET } from './route';
import { requireClientSession } from '@/lib/auth/require-client';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/auth/require-client');
jest.mock('@/lib/commerce/db');

const SESSION = { clientId: 'client-1', coachId: 'coach-1', coachHandle: 'maya-reyes', email: 'client@example.com' };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/client/me', () => {
  it('returns 401 when not authenticated', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the client + coach info for a valid session', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: {
        clients: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1', email: 'client@example.com', name: 'Alex' }) },
        coaches: { findFirst: jest.fn().mockResolvedValue({ id: 'coach-1', handle: 'maya-reyes', displayName: 'Maya Reyes' }) },
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: { client: { email: 'client@example.com', name: 'Alex' }, coach: { handle: 'maya-reyes', displayName: 'Maya Reyes' } },
    });
  });

  it('returns 401 if the client or coach row no longer exists', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { clients: { findFirst: jest.fn().mockResolvedValue(undefined) }, coaches: { findFirst: jest.fn().mockResolvedValue(undefined) } },
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 500 on a DB error', async () => {
    (requireClientSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { clients: { findFirst: jest.fn().mockRejectedValue(new Error('db down')) }, coaches: { findFirst: jest.fn() } },
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
