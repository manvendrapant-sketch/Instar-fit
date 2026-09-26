import { apiFetch } from './api-client';
import type { BillingInterval, CoachOfferSummary, CreateOfferRequest, OfferType, UpdateOfferRequest } from './commerce/types';

// Offer builder. An OfferDraft is exactly the real API's CoachOfferSummary — includes, program
// length, session length and the `active`/"shown on storefront" flag are all part of that shared
// contract now, not frontend-only extras.
export type OfferDraft = CoachOfferSummary;

export type OfferField = 'type' | 'name' | 'description' | 'price' | 'lengthWeeks' | 'includes' | 'sessionMinutes';
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
    active: true,
    // Overwritten by the server on create (position is assigned there); harmless placeholder
    // until then, and simply carried over as-is on every later edit.
    position: 0,
  };
}

/** Switching type keeps name, description, includes and position, and resets the type-specific fields. */
export function changeOfferType(o: OfferDraft, type: OfferType): OfferDraft {
  const fresh = blankOffer(type, o.id);
  return {
    ...fresh,
    name: o.name,
    description: o.description,
    includes: o.includes,
    active: o.active,
    position: o.position,
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

// --- Backend calls -----------------------------------------------------------------------

export function toCreateRequest(o: OfferDraft): CreateOfferRequest {
  return {
    type: o.type,
    name: o.name,
    description: o.description,
    price: o.price,
    includes: o.includes,
    lengthWeeks: o.lengthWeeks,
    sessionMinutes: o.sessionMinutes,
  };
}

/**
 * The offer builder submits the whole draft, so this sends every field except `price` — that one
 * is included only if it actually differs from `original` (the offer as loaded). Replacing a price
 * always creates a new Stripe Price on the backend (Stripe Prices are immutable), which is wasted
 * work on every trivial rename if sent unconditionally, and outright fails for any offer whose
 * Stripe product belongs to a different Stripe account/key than the one currently configured
 * (e.g. after rotating STRIPE_SECRET_KEY) — a plain rename shouldn't be blocked by that.
 */
export function toUpdateRequest(o: OfferDraft, original?: OfferDraft): UpdateOfferRequest {
  const priceChanged = !original || JSON.stringify(o.price) !== JSON.stringify(original.price);
  return {
    name: o.name,
    description: o.description,
    active: o.active,
    includes: o.includes,
    lengthWeeks: o.lengthWeeks,
    sessionMinutes: o.sessionMinutes,
    ...(priceChanged ? { price: o.price } : {}),
  };
}

// The backend's field-error keys don't line up 1:1 with the form's own field slots (there's one
// price box for both unitAmountCents and interval; type/active have no dedicated slot at all) —
// this maps its keys onto this form's own OfferField names.
function mapOfferFields(fields?: Record<string, string>): OfferErrors {
  if (!fields) return {};
  const errors: OfferErrors = {};
  if (fields.name) errors.name = fields.name;
  if (fields.includes) errors.includes = fields.includes;
  if (fields.lengthWeeks) errors.lengthWeeks = fields.lengthWeeks;
  if (fields.sessionMinutes) errors.sessionMinutes = fields.sessionMinutes;
  if (fields.unitAmountCents) errors.price = fields.unitAmountCents;
  else if (fields.interval) errors.price = fields.interval;
  return errors;
}

export type OfferResult = { ok: true; offer: CoachOfferSummary } | { ok: false; message: string; fieldErrors: OfferErrors };

export async function fetchOffers(): Promise<{ ok: true; offers: CoachOfferSummary[] } | { ok: false; message: string }> {
  const result = await apiFetch<{ offers: CoachOfferSummary[] }>('/api/offers');
  if (result.success) return { ok: true, offers: result.data.offers };
  return { ok: false, message: result.message };
}

export async function createOfferApi(input: CreateOfferRequest): Promise<OfferResult> {
  const result = await apiFetch<{ offer: CoachOfferSummary }>('/api/offers', { method: 'POST', body: input });
  if (result.success) return { ok: true, offer: result.data.offer };
  return { ok: false, message: result.message, fieldErrors: mapOfferFields(result.fields) };
}

export async function updateOfferApi(id: string, input: UpdateOfferRequest): Promise<OfferResult> {
  const result = await apiFetch<{ offer: CoachOfferSummary }>(`/api/offers/${id}`, { method: 'PATCH', body: input });
  if (result.success) return { ok: true, offer: result.data.offer };
  return { ok: false, message: result.message, fieldErrors: mapOfferFields(result.fields) };
}

export async function deleteOfferApi(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await apiFetch<{ id: string }>(`/api/offers/${id}`, { method: 'DELETE' });
  if (result.success) return { ok: true };
  return { ok: false, message: result.message };
}

export async function reorderOffersApi(orderedIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await apiFetch<{ orderedIds: string[] }>('/api/offers/reorder', {
    method: 'PATCH',
    body: { orderedIds },
  });
  if (result.success) return { ok: true };
  return { ok: false, message: result.message };
}
