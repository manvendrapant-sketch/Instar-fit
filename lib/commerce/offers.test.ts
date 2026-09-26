import { getStripe } from '@/lib/stripe/client';
import {
  createStripeProductAndPrice,
  createStripeReplacementPrice,
  toCoachOfferSummary,
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
        includes: [],
        lengthWeeks: null,
        sessionMinutes: null,
      },
    });
  });

  it('accepts includes, trimming and dropping blank lines', () => {
    const result = validateCreateOfferInput({
      type: 'one_time',
      name: 'Block',
      price: { unitAmountCents: 9900 },
      includes: [' Custom plan ', '', '  '],
    });
    expect(result).toEqual({ value: expect.objectContaining({ includes: ['Custom plan'] }) });
  });

  it('rejects more than 8 include lines, or a line over 80 characters', () => {
    const many = Array.from({ length: 9 }, (_, i) => `Item ${i}`);
    expect(
      validateCreateOfferInput({ type: 'one_time', name: 'Block', price: { unitAmountCents: 100 }, includes: many }),
    ).toHaveProperty('errors.includes');
    expect(
      validateCreateOfferInput({
        type: 'one_time',
        name: 'Block',
        price: { unitAmountCents: 100 },
        includes: ['a'.repeat(81)],
      }),
    ).toHaveProperty('errors.includes');
  });

  it('accepts lengthWeeks only for one_time offers', () => {
    expect(
      validateCreateOfferInput({ type: 'one_time', name: 'Block', price: { unitAmountCents: 100 }, lengthWeeks: 12 }),
    ).toEqual({ value: expect.objectContaining({ lengthWeeks: 12 }) });
    expect(
      validateCreateOfferInput({ type: 'session', name: 'Call', price: { unitAmountCents: 100 }, lengthWeeks: 12 }),
    ).toHaveProperty('errors.lengthWeeks');
    expect(
      validateCreateOfferInput({ type: 'one_time', name: 'Block', price: { unitAmountCents: 100 }, lengthWeeks: 53 }),
    ).toHaveProperty('errors.lengthWeeks');
  });

  it('accepts sessionMinutes only for session offers', () => {
    expect(
      validateCreateOfferInput({ type: 'session', name: 'Call', price: { unitAmountCents: 100 }, sessionMinutes: 30 }),
    ).toEqual({ value: expect.objectContaining({ sessionMinutes: 30 }) });
    expect(
      validateCreateOfferInput({ type: 'one_time', name: 'Block', price: { unitAmountCents: 100 }, sessionMinutes: 30 }),
    ).toHaveProperty('errors.sessionMinutes');
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

  it('leaves includes/lengthWeeks/sessionMinutes untouched when not provided', () => {
    const result = validateUpdateOfferInput({ name: 'New name' }, 'one_time');
    expect(result).toEqual({ value: { name: 'New name' } });
  });
});

describe('toCoachOfferSummary', () => {
  it('assembles the API shape from an offer row and its active price row', () => {
    const offer = {
      id: 'offer-1',
      type: 'session' as const,
      name: 'Discovery call',
      description: null,
      active: true,
      position: 2,
      includes: ['Bring water'],
      lengthWeeks: null,
      sessionMinutes: 30,
    };
    const price = { currency: 'usd', unitAmountCents: 4900, interval: null, intervalCount: null };
    // @ts-expect-error — test rows are a subset of the full Drizzle row shape.
    expect(toCoachOfferSummary(offer, price)).toEqual({
      id: 'offer-1',
      type: 'session',
      name: 'Discovery call',
      description: null,
      active: true,
      position: 2,
      includes: ['Bring water'],
      lengthWeeks: null,
      sessionMinutes: 30,
      price: { currency: 'usd', unitAmountCents: 4900, interval: null, intervalCount: null },
    });
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
