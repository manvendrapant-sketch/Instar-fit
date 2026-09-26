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

/** GET /api/coach/onboarding-status. */
export interface OnboardingStatus {
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
}

/** POST /api/coach/connect/account-link — creates (or reuses) the coach's Stripe Express account. */
export interface CreateAccountLinkRequest {
  /** App path Stripe returns the coach to once onboarding completes. Defaults to '/business'. */
  returnPath?: string;
  /** App path Stripe returns the coach to if the link expires mid-flow. Defaults to '/business'. */
  refreshPath?: string;
}
export interface CreateAccountLinkResponse {
  url: string;
}

/** The coach's own view of an offer — adds fields the public profile never shows. */
export interface CoachOfferSummary extends OfferSummary {
  active: boolean;
  position: number;
}

/** POST /api/offers request body. */
export interface CreateOfferRequest {
  type: OfferType;
  name: string;
  description: string | null;
  price: OfferPrice;
}

/** PATCH /api/offers/[id] request body — all fields optional, only provided ones change. */
export interface UpdateOfferRequest {
  name?: string;
  description?: string | null;
  active?: boolean;
  /** Replacing this creates a new Stripe Price and retires the old one — Stripe Prices are immutable. */
  price?: OfferPrice;
}

/** PATCH /api/offers/reorder request body — the coach's full offer id list in the new order. */
export interface ReorderOffersRequest {
  orderedIds: string[];
}

/** GET /api/offers/quote?unitAmountCents=&currency= — the offer builder's live "you'll receive" preview. */
export interface OfferQuoteResponse extends MoneyBreakdown {
  /** baseAmountCents - platformFeeCents: what reaches the coach's connected account before Stripe's own processing costs. */
  coachReceivesCents: number;
}

/** GET /api/storefront, PATCH /api/storefront. */
export interface StorefrontStatus {
  handle: string;
  published: boolean;
  /** True once Connect payouts are ready and the coach has at least one active offer. */
  canPublish: boolean;
  connectStatus: ConnectStatus;
  /** Path (not a full URL) to the public storefront, e.g. "/maya-reyes". */
  publicUrl: string;
}

/** PATCH /api/storefront request body. */
export interface UpdateStorefrontRequest {
  published: boolean;
}
