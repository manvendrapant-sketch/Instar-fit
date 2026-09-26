import { GET, POST } from '@/app/api/offers/route';
import { getDb } from '@/lib/commerce/db';
import { createStripeProductAndPrice } from '@/lib/commerce/offers';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/offers', () => ({
  ...jest.requireActual('@/lib/commerce/offers'),
  createStripeProductAndPrice: jest.fn(),
}));

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

function selectListChain(result: unknown[]) {
  const orderBy = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ orderBy });
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  return { from };
}

function selectPositionChain(result: unknown[]) {
  const limit = jest.fn().mockResolvedValue(result);
  const orderBy = jest.fn().mockReturnValue({ limit });
  const where = jest.fn().mockReturnValue({ orderBy });
  const from = jest.fn().mockReturnValue({ where });
  return { from };
}

function insertChain(returningResult: unknown[]) {
  const returning = jest.fn().mockResolvedValue(returningResult);
  const values = jest.fn().mockReturnValue({ returning });
  return { values };
}

function offersRequest(body: unknown) {
  return new Request('http://localhost/api/offers', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/offers', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('lists the coach’s offers with their active price, ordered by position', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const row = {
      offer: {
        id: 'offer-1',
        type: 'one_time',
        name: 'Kickoff call',
        description: null,
        active: true,
        position: 0,
        includes: [],
        lengthWeeks: null,
        sessionMinutes: null,
      },
      price: { currency: 'usd', unitAmountCents: 5000, interval: null, intervalCount: null },
    };
    const select = jest.fn().mockReturnValue(selectListChain([row]));
    (getDb as jest.Mock).mockReturnValue({ select });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: 'Offers loaded.',
      data: {
        offers: [
          {
            id: 'offer-1',
            type: 'one_time',
            name: 'Kickoff call',
            description: null,
            active: true,
            position: 0,
            includes: [],
            lengthWeeks: null,
            sessionMinutes: null,
            price: { currency: 'usd', unitAmountCents: 5000, interval: null, intervalCount: null },
          },
        ],
      },
    });
  });
});

describe('POST /api/offers', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(offersRequest({}));
    expect(res.status).toBe(401);
  });

  it('returns 422 with field errors for an invalid body', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const res = await POST(offersRequest({ type: 'one_time', name: '', price: { unitAmountCents: 0 } }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.fields).toHaveProperty('name');
    expect(json.fields).toHaveProperty('unitAmountCents');
  });

  it('creates the Stripe product/price, then the offer at position 0 when the coach has no offers yet', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (createStripeProductAndPrice as jest.Mock).mockResolvedValue({
      stripeProductId: 'prod_1',
      stripePriceId: 'price_1',
    });

    const select = jest.fn().mockReturnValueOnce(selectPositionChain([]));
    const offerRow = {
      id: 'offer-1',
      coachId: 'coach-1',
      type: 'one_time',
      name: 'Kickoff call',
      description: null,
      active: true,
      position: 0,
      includes: [],
      lengthWeeks: null,
      sessionMinutes: null,
      stripeProductId: 'prod_1',
    };
    const priceRow = {
      id: 'price-row-1',
      offerId: 'offer-1',
      currency: 'usd',
      unitAmountCents: 5000,
      interval: null,
      intervalCount: null,
    };
    const insert = jest.fn().mockReturnValueOnce(insertChain([offerRow])).mockReturnValueOnce(insertChain([priceRow]));
    (getDb as jest.Mock).mockReturnValue({ select, insert });

    const res = await POST(offersRequest({ type: 'one_time', name: 'Kickoff call', price: { unitAmountCents: 5000 } }));

    expect(res.status).toBe(201);
    expect(createStripeProductAndPrice).toHaveBeenCalledWith({
      type: 'one_time',
      name: 'Kickoff call',
      description: null,
      price: { currency: 'usd', unitAmountCents: 5000, interval: null, intervalCount: null },
      includes: [],
      lengthWeeks: null,
      sessionMinutes: null,
    });
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: {
        offer: {
          id: 'offer-1',
          type: 'one_time',
          name: 'Kickoff call',
          position: 0,
          price: { currency: 'usd', unitAmountCents: 5000 },
        },
      },
    });
  });
});
