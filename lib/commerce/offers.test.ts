import { getStripe } from '@/lib/stripe/client';
import {
  createStripeProductAndPrice,
  createStripeReplacementPrice,
  validateCreateOfferInput,
  validateUpdateOfferInput,
} from './offers';

jest.mock('@/lib/stripe/client');

describe('validateCreateOfferInput', () => {
  it('rejects a missing/invalid type', () => {
    const result = validateCreateOfferInput({ name: 'x', price: { unitAmountCents: 100 } });
    expect(result).toHaveProperty('errors.type');
  });

  it('rejects a blank name', () => {
    const result = validateCreateOfferInput({ type: 'one_time', name: '  ', price: { unitAmountCents: 100 } });
    expect(result).toHaveProperty('errors.name');
  });

  it('rejects a non-positive price', () => {
    const result = validateCreateOfferInput({ type: 'one_time', name: 'Kickoff call', price: { unitAmountCents: 0 } });
    expect(result).toHaveProperty('errors.unitAmountCents');
  });

  it('requires an interval for a subscription offer', () => {
    const result = validateCreateOfferInput({
      type: 'subscription',
      name: 'Monthly coaching',
      price: { unitAmountCents: 9900 },
    });
    expect(result).toHaveProperty('errors.interval');
  });

  it('rejects an interval on a one_time offer', () => {
    const result = validateCreateOfferInput({
      type: 'one_time',
      name: 'Kickoff call',
      price: { unitAmountCents: 9900, interval: 'month' },
    });
    expect(result).toHaveProperty('errors.interval');
  });

  it('accepts a valid subscription offer, defaulting currency and intervalCount', () => {
    const result = validateCreateOfferInput({
      type: 'subscription',
      name: 'Monthly coaching',
      price: { unitAmountCents: 9900, interval: 'month' },
    });
    expect(result).toEqual({
      value: {
        type: 'subscription',
        name: 'Monthly coaching',
        description: null,
        price: { currency: 'usd', unitAmountCents: 9900, interval: 'month', intervalCount: 1 },
      },
    });
  });
});

describe('validateUpdateOfferInput', () => {
  it('allows a partial update with only active toggled', () => {
    const result = validateUpdateOfferInput({ active: false }, 'one_time');
    expect(result).toEqual({ value: { active: false } });
  });

  it('rejects a non-boolean active field', () => {
    const result = validateUpdateOfferInput({ active: 'yes' }, 'one_time');
    expect(result).toHaveProperty('errors.active');
  });

  it('validates a replacement price against the offer’s existing type', () => {
    const result = validateUpdateOfferInput({ price: { unitAmountCents: 5000 } }, 'subscription');
    expect(result).toHaveProperty('errors.interval');
  });
});

describe('createStripeProductAndPrice', () => {
  it('creates a Product then a Price on it, translating a subscription interval to Stripe’s recurring shape', async () => {
    const productsCreate = jest.fn().mockResolvedValue({ id: 'prod_1' });
    const pricesCreate = jest.fn().mockResolvedValue({ id: 'price_1' });
    (getStripe as jest.Mock).mockReturnValue({ products: { create: productsCreate }, prices: { create: pricesCreate } });

    const result = await createStripeProductAndPrice({
      name: 'Monthly coaching',
      description: null,
      price: { currency: 'usd', unitAmountCents: 9900, interval: 'month', intervalCount: 1 },
    });

    expect(productsCreate).toHaveBeenCalledWith({ name: 'Monthly coaching', description: undefined });
    expect(pricesCreate).toHaveBeenCalledWith({
      product: 'prod_1',
      currency: 'usd',
      unit_amount: 9900,
      recurring: { interval: 'month', interval_count: 1 },
    });
    expect(result).toEqual({ stripeProductId: 'prod_1', stripePriceId: 'price_1' });
  });

  it('omits recurring for a one-time price', async () => {
    const pricesCreate = jest.fn().mockResolvedValue({ id: 'price_2' });
    (getStripe as jest.Mock).mockReturnValue({
      products: { create: jest.fn().mockResolvedValue({ id: 'prod_2' }) },
      prices: { create: pricesCreate },
    });

    await createStripeProductAndPrice({
      name: 'Kickoff call',
      description: null,
      price: { currency: 'usd', unitAmountCents: 5000, interval: null, intervalCount: null },
    });

    expect(pricesCreate).toHaveBeenCalledWith({ product: 'prod_2', currency: 'usd', unit_amount: 5000 });
  });
});

describe('createStripeReplacementPrice', () => {
  it('creates a new Price on the existing Product', async () => {
    const pricesCreate = jest.fn().mockResolvedValue({ id: 'price_new' });
    (getStripe as jest.Mock).mockReturnValue({ prices: { create: pricesCreate } });

    const result = await createStripeReplacementPrice('prod_1', {
      currency: 'usd',
      unitAmountCents: 12000,
      interval: null,
      intervalCount: null,
    });

    expect(pricesCreate).toHaveBeenCalledWith({ product: 'prod_1', currency: 'usd', unit_amount: 12000 });
    expect(result).toEqual({ stripePriceId: 'price_new' });
  });
});
