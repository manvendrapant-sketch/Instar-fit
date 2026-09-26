import { GET } from '@/app/api/coach/[handle]/route';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/commerce/db');

function handleRequest() {
  return new Request('http://localhost/api/coach/maya-reyes');
}

function selectOffersChain(rows: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ orderBy });
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  return { from };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/coach/[handle]', () => {
  it('returns 404 when the handle does not exist', async () => {
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue(undefined) } },
    });

    const res = await GET(handleRequest(), { params: Promise.resolve({ handle: 'nobody' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the coach exists but has not published', async () => {
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue({ handle: 'maya-reyes', published: false }) } },
    });

    const res = await GET(handleRequest(), { params: Promise.resolve({ handle: 'maya-reyes' }) });
    expect(res.status).toBe(404);
  });

  it('returns the public profile with only active offers for a published coach', async () => {
    const coach = {
      id: 'coach-1',
      handle: 'maya-reyes',
      displayName: 'Maya Reyes',
      bio: 'Strength coach',
      avatarUrl: null,
      published: true,
    };
    const select = jest.fn().mockReturnValue(
      selectOffersChain([
        {
          id: 'offer-1',
          type: 'one_time',
          name: 'Kickoff call',
          description: null,
          currency: 'usd',
          unitAmountCents: 5000,
          interval: null,
          intervalCount: null,
        },
      ]),
    );
    (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst: jest.fn().mockResolvedValue(coach) } }, select });

    const res = await GET(handleRequest(), { params: Promise.resolve({ handle: 'maya-reyes' }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: {
        handle: 'maya-reyes',
        displayName: 'Maya Reyes',
        offers: [{ id: 'offer-1', name: 'Kickoff call', price: { unitAmountCents: 5000 } }],
      },
    });
  });
});
