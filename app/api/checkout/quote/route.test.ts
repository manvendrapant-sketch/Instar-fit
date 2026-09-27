import { GET } from '@/app/api/checkout/quote/route';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/commerce/db');

function quoteRequest(query: string) {
  return new Request(`http://localhost/api/checkout/quote${query}`);
}

function selectChain(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  return { from };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PLATFORM_TAKE_RATE_BPS = '200';
  process.env.SERVICE_FEE_RATE_BPS = '300';
});

describe('GET /api/checkout/quote', () => {
  it('returns 422 when offerId is missing', async () => {
    const res = await GET(quoteRequest(''));
    expect(res.status).toBe(422);
  });

  it('returns 404 when the offer does not exist or is inactive', async () => {
    (getDb as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue(selectChain([])) });
    const res = await GET(quoteRequest('?offerId=offer-1'));
    expect(res.status).toBe(404);
  });

  it('returns the offer and a client-safe breakdown (no platformFeeCents)', async () => {
    const row = {
      offer: {
        id: 'offer-1',
        type: 'one_time',
        name: 'Kickoff call',
        description: null,
        includes: ['Custom plan'],
        lengthWeeks: 12,
        sessionMinutes: null,
      },
      price: { currency: 'usd', unitAmountCents: 10000, interval: null, intervalCount: null },
    };
    (getDb as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue(selectChain([row])) });

    const res = await GET(quoteRequest('?offerId=offer-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      offer: {
        id: 'offer-1',
        type: 'one_time',
        name: 'Kickoff call',
        description: null,
        includes: ['Custom plan'],
        lengthWeeks: 12,
        sessionMinutes: null,
        price: { currency: 'usd', unitAmountCents: 10000, interval: null, intervalCount: null },
      },
      breakdown: { currency: 'usd', baseAmountCents: 10000, serviceFeeCents: 300, totalAmountCents: 10300 },
    });
    expect(body.data.breakdown.platformFeeCents).toBeUndefined();
  });
});
