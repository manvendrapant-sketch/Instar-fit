/**
 * The Commerce API contract. This file has no runtime dependency on the database or Stripe —
 * it is safe to import from client components. Storefront/checkout UI should type against this
 * file, not against `schema.ts` (which is the DB's own shape and can change independently).
 *
 * Flag any change to this file to the other side (Manvendra <-> Pari) rather than editing quietly.
 */

export type OfferType = 'subscription' | 'one_time' | 'session';
export type BillingInterval = 'week' | 'month' | 'year';

export interface OfferPrice {
  currency: string;
  unitAmountCents: number;
  interval: BillingInterval | null;
  intervalCount: number | null;
}

export interface OfferSummary {
  id: string;
  type: OfferType;
  name: string;
  description: string | null;
  price: OfferPrice;
}

/** GET /api/coach/[handle] — public storefront data. No auth, no PII beyond what's public. */
export interface CoachPublicProfile {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Only populated once Sprint-2 social-proof wiring exists; absent, not zero, until then. */
  socialProof?: {
    instagramHandle: string;
    followerCount: number;
  };
  offers: OfferSummary[];
}

/**
 * The one place a fee breakdown's shape is defined. Server-computed only — see
 * `lib/commerce/money.ts` for the implementation. The UI displays these numbers verbatim; it
 * never derives them itself.
 */
export interface MoneyBreakdown {
  currency: string;
  baseAmountCents: number;
  /** Disclosed to the client as "Service fee" — never labeled a surcharge. */
  serviceFeeCents: number;
  /** baseAmountCents + serviceFeeCents. What the client's card is actually charged. */
  totalAmountCents: number;
}

/** GET /api/checkout/quote?offerId=... — Sprint 3. Stub shape so Pari can type against it now. */
export interface CheckoutQuoteRequest {
  offerId: string;
}
export interface CheckoutQuoteResponse {
  offer: OfferSummary;
  breakdown: MoneyBreakdown;
}

/** POST /api/checkout — Sprint 3. Stub shape so Pari can type against it now. */
export interface CreateCheckoutSessionRequest {
  offerId: string;
  clientEmail: string;
}
export interface CreateCheckoutSessionResponse {
  checkoutUrl: string;
}

export type ConnectStatus = 'not_started' | 'action_needed' | 'pending_review' | 'ready';

/** GET /api/coach/onboarding-status — Sprint 2 stub. */
export interface OnboardingStatus {
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
}
