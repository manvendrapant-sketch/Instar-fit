import type { BillingInterval, OfferSummary, OfferType } from './commerce/types';

// Offer builder, frontend only. An OfferDraft is the contract's OfferSummary plus the details the
// builder collects that the contract doesn't carry yet (flag these to Manvendra before wiring the
// real offers API): what's included, program length, session length, and storefront visibility.

export interface OfferDraft extends OfferSummary {
  includes: string[];
  /** One-time programs only. */
  lengthWeeks: number | null;
  /** Single sessions only. */
  sessionMinutes: number | null;
  /** Shown on the storefront. Hidden offers stay saved but clients don't see them. */
  visible: boolean;
}

export type OfferField = 'type' | 'name' | 'description' | 'price' | 'lengthWeeks' | 'includes';
export type OfferErrors = Partial<Record<OfferField, string>>;

export const OFFERS_PATH = '/business/offers';
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 280;
export const INCLUDES_MAX = 8;
export const INCLUDE_ITEM_MAX = 80;
export const MIN_PRICE_CENTS = 100; // $1
export const MAX_PRICE_CENTS = 10_000_000; // $100,000
export const SESSION_LENGTHS = [15, 30, 45, 60, 90] as const;
export const INTERVALS: BillingInterval[] = ['week', 'month', 'year'];

export const OFFER_TYPES: Record<OfferType, { label: string; short: string; blurb: string; example: string }> = {
  subscription: {
    label: 'Monthly coaching',
    short: 'Subscription',
    blurb: 'Clients pay every week, month or year until they cancel or pause.',
    example: '1:1 coaching, $199/mo',
  },
  one_time: {
    label: 'Program',
    short: 'Program',
    blurb: 'One payment for a set plan, like a 12-week block.',
    example: '12-week strength block, $499',
  },
  session: {
    label: 'Single session',
    short: 'Session',
    blurb: 'One payment for one call or session.',
    example: 'Discovery call, 30 min, $49',
  },
};

const INTERVAL_SUFFIX: Record<BillingInterval, string> = { week: '/wk', month: '/mo', year: '/yr' };

/**
 * Parses what a coach types in the price box into integer cents. Never goes through a float:
 * "199", "199.5", "1,999.99" and "$49" all parse; anything else returns null.
 */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 100 + Number.parseInt((m[2] ?? '').padEnd(2, '0'), 10);
}

/** Cents back to the box's text: 19900 → "199", 19950 → "199.50". */
export function centsToInput(cents: number | null): string {
  if (cents == null) return '';
  const whole = Math.floor(cents / 100);
  const rem = cents % 100;
  return rem ? `${whole}.${String(rem).padStart(2, '0')}` : String(whole);
}

/** Display money the way the design system writes it: "$8,640", "$199.50". USD only for now. */
export function formatMoney(cents: number): string {
  const whole = Math.floor(cents / 100).toLocaleString('en-US');
  const rem = cents % 100;
  return `$${whole}${rem ? `.${String(rem).padStart(2, '0')}` : ''}`;
}

/** "$199/mo", "$499", "$49 · 30 min", "$499 · 12 weeks". */
export function formatOfferPrice(o: Pick<OfferDraft, 'type' | 'price' | 'lengthWeeks' | 'sessionMinutes'>): string {
  const base = formatMoney(o.price.unitAmountCents);
  if (o.type === 'subscription' && o.price.interval) return base + INTERVAL_SUFFIX[o.price.interval];
  if (o.type === 'session' && o.sessionMinutes) return `${base} · ${o.sessionMinutes} min`;
  if (o.type === 'one_time' && o.lengthWeeks) return `${base} · ${o.lengthWeeks} week${o.lengthWeeks === 1 ? '' : 's'}`;
  return base;
}

export function blankOffer(type: OfferType, id: string): OfferDraft {
  return {
    id,
    type,
    name: '',
    description: null,
    price: {
      currency: 'usd',
      unitAmountCents: 0,
      interval: type === 'subscription' ? 'month' : null,
      intervalCount: type === 'subscription' ? 1 : null,
    },
    includes: [],
    lengthWeeks: null,
    sessionMinutes: type === 'session' ? 60 : null,
    visible: true,
  };
}

/** Switching type keeps name, description and includes, and resets the type-specific fields. */
export function changeOfferType(o: OfferDraft, type: OfferType): OfferDraft {
  const fresh = blankOffer(type, o.id);
  return {
    ...fresh,
    name: o.name,
    description: o.description,
    includes: o.includes,
    visible: o.visible,
    price: { ...fresh.price, unitAmountCents: o.price.unitAmountCents },
  };
}

export function isOfferType(v: unknown): v is OfferType {
  return v === 'subscription' || v === 'one_time' || v === 'session';
}

/**
 * `priceInput` is the raw text from the price box; the draft's cents only update once it parses,
 * so validation checks the text the coach actually sees.
 */
export function validateOffer(o: OfferDraft, priceInput: string): OfferErrors {
  const errors: OfferErrors = {};
  const name = o.name.trim();
  if (!name) errors.name = 'Name this offer so clients know what they’re buying.';
  else if (name.length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters.`;
  if ((o.description ?? '').length > DESCRIPTION_MAX) errors.description = `Keep it under ${DESCRIPTION_MAX} characters.`;

  const cents = parsePriceToCents(priceInput);
  if (!priceInput.trim()) errors.price = 'Set a price.';
  else if (cents == null) errors.price = 'Enter a price like 199 or 199.50.';
  else if (cents < MIN_PRICE_CENTS) errors.price = 'The lowest price is $1.';
  else if (cents > MAX_PRICE_CENTS) errors.price = 'The highest price is $100,000.';

  if (o.type === 'one_time' && o.lengthWeeks != null && (o.lengthWeeks < 1 || o.lengthWeeks > 52 || !Number.isInteger(o.lengthWeeks))) {
    errors.lengthWeeks = 'Use 1 to 52 weeks, or leave it blank.';
  }
  const items = o.includes.map((i) => i.trim()).filter(Boolean);
  if (items.length > INCLUDES_MAX) errors.includes = `List up to ${INCLUDES_MAX} things.`;
  else if (items.some((i) => i.length > INCLUDE_ITEM_MAX)) errors.includes = `Keep each line under ${INCLUDE_ITEM_MAX} characters.`;
  return errors;
}

/** Trims text fields, drops empty include lines and applies the parsed price. Call after validating. */
export function finalizeOffer(o: OfferDraft, priceInput: string): OfferDraft {
  return {
    ...o,
    name: o.name.trim(),
    description: o.description?.trim() || null,
    includes: o.includes.map((i) => i.trim()).filter(Boolean),
    price: { ...o.price, unitAmountCents: parsePriceToCents(priceInput) ?? o.price.unitAmountCents },
  };
}

/** Insert or replace by id, keeping the offer's place in the list. */
export function upsertOffer(list: OfferDraft[], offer: OfferDraft): OfferDraft[] {
  const i = list.findIndex((o) => o.id === offer.id);
  if (i === -1) return [...list, offer];
  const next = list.slice();
  next[i] = offer;
  return next;
}

/** Move an offer one place up (-1) or down (+1). Out-of-range moves return the list unchanged. */
export function moveOffer(list: OfferDraft[], id: string, dir: -1 | 1): OfferDraft[] {
  const i = list.findIndex((o) => o.id === id);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
