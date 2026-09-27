import { POST } from '@/app/api/checkout/route';
import { getDb } from '@/lib/commerce/db';
import { createCheckoutSession } from '@/lib/commerce/checkout';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/commerce/checkout');

function checkoutRequest(body: unknown) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function selectChain(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  return { from };
}

const OFFER_ROW = {
  offer: { id: 'offer-1', coachId: 'coach-1', type: 'one_time' as const },
  price: { stripePriceId: 'price_1', currency: 'usd', unitAmountCents: 10000, interval: null, intervalCount: null },
};
const COACH = { id: 'coach-1', handle: 'maya-reyes', published: true };
const ACCOUNT = { stripeAccountId: 'acct_1', chargesEnabled: true };

function mockDb(opts: {
  offerRows?: unknown[];
  coach?: unknown;
  account?: unknown;
}) {
  const select = jest.fn().mockReturnValue(selectChain(opts.offerRows ?? [OFFER_ROW]));
  const coachFindFirst = jest.fn().mockResolvedValue('coach' in opts ? opts.coach : COACH);
  const accountFindFirst = jest.fn().mockResolvedValue('account' in opts ? opts.account : ACCOUNT);
  (getDb as jest.Mock).mockReturnValue({
    select,
    query: { coaches: { findFirst: coachFindFirst }, connectedAccounts: { findFirst: accountFindFirst } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (createCheckoutSession as jest.Mock).mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/pay/123' });
});

describe('POST /api/checkout', () => {
  it('returns 422 when offerId or clientEmail is missing/invalid', async () => {
    const res = await POST(checkoutRequest({ offerId: '', clientEmail: 'not-an-email' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields).toEqual({ offerId: 'offerId is required.', clientEmail: 'Enter a valid email address.' });
  });

  it('returns 400 on invalid JSON', async () => {
    const res = await POST(new Request('http://localhost/api/checkout', { method: 'POST', body: '{bad json' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the offer does not exist or is inactive', async () => {
    mockDb({ offerRows: [] });
    const res = await POST(checkoutRequest({ offerId: 'offer-1', clientEmail: 'a@b.com' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the coach is not published', async () => {
    mockDb({ coach: { ...COACH, published: false } });
    const res = await POST(checkoutRequest({ offerId: 'offer-1', clientEmail: 'a@b.com' }));
    expect(res.status).toBe(404);
  });

  it('returns 422 NOT_READY when the coach has no chargesEnabled connected account', async () => {
    mockDb({ account: null });
    const res = await POST(checkoutRequest({ offerId: 'offer-1', clientEmail: 'a@b.com' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('NOT_READY');
  });

  it('creates a Checkout Session and returns its url, defaulting success/cancel paths to the storefront', async () => {
    mockDb({});
    const res = await POST(checkoutRequest({ offerId: 'offer-1', clientEmail: 'A@B.com' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { checkoutUrl: 'https://checkout.stripe.com/pay/123' } });
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        offerId: 'offer-1',
        offerType: 'one_time',
        coachId: 'coach-1',
        connectedAccountId: 'acct_1',
        clientEmail: 'a@b.com',
        successUrl: 'http://localhost/maya-reyes?checkout=success',
        cancelUrl: 'http://localhost/maya-reyes?checkout=cancelled',
      }),
    );
  });

  it('honors an explicit successPath/cancelPath', async () => {
    mockDb({});
    await POST(
      checkoutRequest({
        offerId: 'offer-1',
        clientEmail: 'a@b.com',
        successPath: '/thank-you',
        cancelPath: '/try-again',
      }),
    );

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: 'http://localhost/thank-you',
        cancelUrl: 'http://localhost/try-again',
      }),
    );
  });
});
