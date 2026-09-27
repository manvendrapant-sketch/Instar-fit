import { createCheckoutSession } from './checkout';
import { getStripe } from '@/lib/stripe/client';

jest.mock('@/lib/stripe/client');

function mockStripeSessionCreate(session: unknown) {
  const create = jest.fn().mockResolvedValue(session);
  (getStripe as jest.Mock).mockReturnValue({ checkout: { sessions: { create } } });
  return create;
}

const basePrice = { stripePriceId: 'price_123', currency: 'usd', unitAmountCents: 10000, interval: null, intervalCount: null };

describe('createCheckoutSession', () => {
  it('creates a payment-mode session for a one-time offer with application_fee_amount and on_behalf_of', async () => {
    const create = mockStripeSessionCreate({ url: 'https://checkout.stripe.com/pay/123' });

    const result = await createCheckoutSession({
      offerId: 'offer-1',
      offerType: 'one_time',
      coachId: 'coach-1',
      connectedAccountId: 'acct_1',
      price: basePrice,
      clientEmail: 'client@example.com',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    });

    expect(result).toEqual({
      checkoutUrl: 'https://checkout.stripe.com/pay/123',
      breakdown: { currency: 'usd', baseAmountCents: 10000, serviceFeeCents: 300, totalAmountCents: 10300, platformFeeCents: 200 },
    });

    const [params] = create.mock.calls[0];
    expect(params.mode).toBe('payment');
    expect(params.customer_creation).toBe('always');
    expect(params.line_items).toEqual([
      { price: 'price_123', quantity: 1 },
      { price_data: { currency: 'usd', unit_amount: 300, product_data: { name: 'Service fee' } }, quantity: 1 },
    ]);
    expect(params.payment_intent_data).toMatchObject({
      application_fee_amount: 200,
      on_behalf_of: 'acct_1',
      transfer_data: { destination: 'acct_1' },
    });
    expect(params.payment_intent_data.metadata).toMatchObject({
      coachId: 'coach-1',
      offerId: 'offer-1',
      clientEmail: 'client@example.com',
      baseAmountCents: '10000',
      serviceFeeCents: '300',
      platformFeeCents: '200',
      totalAmountCents: '10300',
    });
    expect(params.subscription_data).toBeUndefined();
  });

  it('creates a subscription-mode session with a recurring service-fee line and application_fee_percent', async () => {
    const create = mockStripeSessionCreate({ url: 'https://checkout.stripe.com/pay/456' });

    await createCheckoutSession({
      offerId: 'offer-2',
      offerType: 'subscription',
      coachId: 'coach-1',
      connectedAccountId: 'acct_1',
      price: { ...basePrice, interval: 'month', intervalCount: 1 },
      clientEmail: 'client@example.com',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel',
    });

    const [params] = create.mock.calls[0];
    expect(params.mode).toBe('subscription');
    expect(params.customer_creation).toBeUndefined();
    expect(params.line_items[1].price_data.recurring).toEqual({ interval: 'month', interval_count: 1 });
    expect(params.subscription_data).toMatchObject({
      application_fee_percent: 2,
      on_behalf_of: 'acct_1',
      transfer_data: { destination: 'acct_1' },
    });
    expect(params.payment_intent_data).toBeUndefined();
  });

  it('throws when Stripe does not return a Checkout URL', async () => {
    mockStripeSessionCreate({ url: null });

    await expect(
      createCheckoutSession({
        offerId: 'offer-1',
        offerType: 'one_time',
        coachId: 'coach-1',
        connectedAccountId: 'acct_1',
        price: basePrice,
        clientEmail: 'client@example.com',
        successUrl: 'https://app.test/success',
        cancelUrl: 'https://app.test/cancel',
      }),
    ).rejects.toThrow('Stripe did not return a Checkout URL.');
  });
});
