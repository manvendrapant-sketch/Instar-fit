import { GET } from '@/app/api/offers/quote/route';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function quoteRequest(query: string) {
  return new Request(`http://localhost/api/offers/quote${query}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PLATFORM_TAKE_RATE_BPS = '200';
  process.env.SERVICE_FEE_RATE_BPS = '300';
});

describe('GET /api/offers/quote', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET(quoteRequest('?unitAmountCents=5000'));
    expect(res.status).toBe(401);
  });

  it('returns 422 when unitAmountCents is missing or not a positive integer', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const res = await GET(quoteRequest('?unitAmountCents=0'));
    expect(res.status).toBe(422);
  });

  it('computes the breakdown plus what the coach receives', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const res = await GET(quoteRequest('?unitAmountCents=10000'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      data: {
        currency: 'usd',
        baseAmountCents: 10000,
        serviceFeeCents: 300,
        totalAmountCents: 10300,
        platformFeeCents: 200,
        coachReceivesCents: 9800,
      },
    });
  });
});
