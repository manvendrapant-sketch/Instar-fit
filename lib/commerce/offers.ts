import 'server-only';
import { getStripe } from '@/lib/stripe/client';
import type { BillingInterval, OfferPrice, OfferType } from './types';

const OFFER_TYPES: OfferType[] = ['subscription', 'one_time', 'session'];
const BILLING_INTERVALS: BillingInterval[] = ['week', 'month', 'year'];

export interface OfferInput {
  type: OfferType;
  name: string;
  description: string | null;
  price: OfferPrice;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validatePrice(
  type: OfferType,
  priceRaw: Record<string, unknown>,
  errors: Record<string, string>,
): OfferPrice {
  const currency =
    typeof priceRaw.currency === 'string' && priceRaw.currency.trim() ? priceRaw.currency.trim().toLowerCase() : 'usd';

  if (!isPositiveInteger(priceRaw.unitAmountCents)) {
    errors.unitAmountCents = 'Enter a price greater than $0.';
  }
  const unitAmountCents = isPositiveInteger(priceRaw.unitAmountCents) ? priceRaw.unitAmountCents : 0;

  if (type === 'subscription') {
    const interval = BILLING_INTERVALS.includes(priceRaw.interval as BillingInterval)
      ? (priceRaw.interval as BillingInterval)
      : null;
    if (!interval) errors.interval = 'Choose how often to bill (week, month, or year).';
    const intervalCount = isPositiveInteger(priceRaw.intervalCount) ? priceRaw.intervalCount : 1;
    return { currency, unitAmountCents, interval, intervalCount };
  }

  if (priceRaw.interval != null || priceRaw.intervalCount != null) {
    errors.interval = 'One-time and session offers cannot have a billing interval.';
  }
  return { currency, unitAmountCents, interval: null, intervalCount: null };
}

/** Full validation for POST /api/offers (type is required and fixed for the offer's lifetime). */
export function validateCreateOfferInput(body: unknown): { errors: Record<string, string> } | { value: OfferInput } {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const type = OFFER_TYPES.includes(b.type as OfferType) ? (b.type as OfferType) : undefined;
  if (!type) errors.type = 'Choose a valid offer type.';

  const name = typeof b.name === 'string' && b.name.trim().length > 0 ? b.name.trim() : '';
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.';

  const description =
    typeof b.description === 'string' && b.description.trim().length > 0 ? b.description.trim() : null;

  const price = validatePrice(type ?? 'one_time', (b.price ?? {}) as Record<string, unknown>, errors);

  if (Object.keys(errors).length > 0) return { errors };
  return { value: { type: type as OfferType, name, description, price } };
}

export interface UpdateOfferInput {
  name?: string;
  description?: string | null;
  active?: boolean;
  price?: OfferPrice;
}

/** Partial validation for PATCH /api/offers/[id] — `existingType` decides the price's interval rules. */
export function validateUpdateOfferInput(
  body: unknown,
  existingType: OfferType,
): { errors: Record<string, string> } | { value: UpdateOfferInput } {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const value: UpdateOfferInput = {};

  if ('name' in b) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.';
    else value.name = name;
  }

  if ('description' in b) {
    value.description = typeof b.description === 'string' && b.description.trim() ? b.description.trim() : null;
  }

  if ('active' in b) {
    if (typeof b.active !== 'boolean') errors.active = 'active must be true or false.';
    else value.active = b.active;
  }

  if ('price' in b) {
    value.price = validatePrice(existingType, (b.price ?? {}) as Record<string, unknown>, errors);
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { value };
}

/** Creates the Stripe Product + Price backing a new offer. Test mode only until Sprint 6 (see CLAUDE.md). */
export async function createStripeProductAndPrice(
  input: Pick<OfferInput, 'name' | 'description' | 'price'>,
): Promise<{ stripeProductId: string; stripePriceId: string }> {
  const stripe = getStripe();
  const product = await stripe.products.create({ name: input.name, description: input.description ?? undefined });
  const price = await stripe.prices.create({
    product: product.id,
    currency: input.price.currency,
    unit_amount: input.price.unitAmountCents,
    ...(input.price.interval
      ? { recurring: { interval: input.price.interval, interval_count: input.price.intervalCount ?? 1 } }
      : {}),
  });
  return { stripeProductId: product.id, stripePriceId: price.id };
}

/** Creates a replacement Stripe Price on an existing Product — Stripe Prices themselves are immutable. */
export async function createStripeReplacementPrice(
  stripeProductId: string,
  price: OfferPrice,
): Promise<{ stripePriceId: string }> {
  const stripe = getStripe();
  const created = await stripe.prices.create({
    product: stripeProductId,
    currency: price.currency,
    unit_amount: price.unitAmountCents,
    ...(price.interval ? { recurring: { interval: price.interval, interval_count: price.intervalCount ?? 1 } } : {}),
  });
  return { stripePriceId: created.id };
}
