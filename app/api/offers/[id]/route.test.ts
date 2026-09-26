import { PATCH } from '@/app/api/offers/[id]/route';
import { getDb } from '@/lib/commerce/db';
import { createStripeReplacementPrice } from '@/lib/commerce/offers';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/require-coach');
jest.mock('@/lib/commerce/offers', () => ({
  ...jest.requireActual('@/lib/commerce/offers'),
  createStripeReplacementPrice: jest.fn(),
}));

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

const OFFER = {
  id: 'offer-1',
  coachId: 'coach-1',
  type: 'one_time' as const,
  name: 'Kickoff call',
  description: null,
  active: true,
  position: 0,
  stripeProductId: 'prod_1',
};

const ACTIVE_PRICE = {
  id: 'price-1',
  offerId: 'offer-1',
  active: true,
  currency: 'usd',
  unitAmountCents: 5000,
  interval: null,
  intervalCount: null,
};

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/offers/offer-1', { method: 'PATCH', body: JSON.stringify(body) });
}

function updateChain() {
  return { set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) };
}

function insertChain(returningResult: unknown[]) {
  const returning = jest.fn().mockResolvedValue(returningResult);
  const values = jest.fn().mockReturnValue({ returning });
  return { values };
}

function baseDb(overrides: { offersFindFirst: jest.Mock; pricesFindFirst?: jest.Mock }) {
  return {
    query: {
      offers: { findFirst: overrides.offersFindFirst },
      prices: { findFirst: overrides.pricesFindFirst ?? jest.fn().mockResolvedValue(ACTIVE_PRICE) },
    },
    update: jest.fn().mockReturnValue(updateChain()),
    insert: jest.fn().mockReturnValue(insertChain([])),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PATCH /api/offers/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(patchRequest({ active: false }), { params: Promise.resolve({ id: 'offer-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the offer does not belong to this coach', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb({ offersFindFirst: jest.fn().mockResolvedValue(undefined) }));

    const res = await PATCH(patchRequest({ active: false }), { params: Promise.resolve({ id: 'offer-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 422 for an invalid field', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue(baseDb({ offersFindFirst: jest.fn().mockResolvedValue(OFFER) }));

    const res = await PATCH(patchRequest({ active: 'nope' }), { params: Promise.resolve({ id: 'offer-1' }) });
    expect(res.status).toBe(422);
  });

  it('updates name/active without touching Stripe when no price is provided', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const offersFindFirst = jest
      .fn()
      .mockResolvedValueOnce(OFFER)
      .mockResolvedValueOnce({ ...OFFER, name: 'Discovery call', active: false });
    (getDb as jest.Mock).mockReturnValue(baseDb({ offersFindFirst }));

    const res = await PATCH(patchRequest({ name: 'Discovery call', active: false }), {
      params: Promise.resolve({ id: 'offer-1' }),
    });

    expect(res.status).toBe(200);
    expect(createStripeReplacementPrice).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { offer: { name: 'Discovery call', active: false, price: { unitAmountCents: 5000 } } },
    });
  });

  it('replaces the price via Stripe, retiring the old one, when a new price is provided', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (createStripeReplacementPrice as jest.Mock).mockResolvedValue({ stripePriceId: 'price_new' });
    const offersFindFirst = jest.fn().mockResolvedValueOnce(OFFER).mockResolvedValueOnce(OFFER);
    const pricesFindFirst = jest.fn().mockResolvedValue(ACTIVE_PRICE);
    const newPriceRow = { ...ACTIVE_PRICE, id: 'price-2', unitAmountCents: 7500 };
    const insert = jest.fn().mockReturnValue(insertChain([newPriceRow]));
    const update = jest.fn().mockReturnValue(updateChain());
    (getDb as jest.Mock).mockReturnValue({
      query: { offers: { findFirst: offersFindFirst }, prices: { findFirst: pricesFindFirst } },
      update,
      insert,
    });

    const res = await PATCH(patchRequest({ price: { unitAmountCents: 7500 } }), {
      params: Promise.resolve({ id: 'offer-1' }),
    });

    expect(res.status).toBe(200);
    expect(createStripeReplacementPrice).toHaveBeenCalledWith('prod_1', {
      currency: 'usd',
      unitAmountCents: 7500,
      interval: null,
      intervalCount: null,
    });
    await expect(res.json()).resolves.toMatchObject({ data: { offer: { price: { unitAmountCents: 7500 } } } });
  });
});
