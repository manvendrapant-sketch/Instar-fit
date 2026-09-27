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
  /** Bullet points shown under the description, e.g. "Weekly check-in". */
  includes: string[];
  /** `one_time` offers only; null otherwise. */
  lengthWeeks: number | null;
  /** `session` offers only; null otherwise. */
  sessionMinutes: number | null;
}

export type CoachingMode = 'online' | 'in_person' | 'both';

/** GET /api/coach/[handle] — public storefront data. No auth, no PII beyond what's public. */
export interface CoachPublicProfile {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  specialties: string[];
  location: string | null;
  coachingMode: CoachingMode;
  /** Only populated once Sprint-2 social-proof wiring exists; absent, not zero, until then. */
  socialProof?: {
    instagramHandle: string;
    followerCount: number;
  };
  offers: OfferSummary[];
}

/**
 * GET /api/coach/profile, PATCH /api/coach/profile — the coach's own editable storefront profile.
 * A superset of `CoachPublicProfile`: adds `timeZone`, used for session/check-in times and never
 * shown on the public profile, and `completed`, which is false until the first PATCH (so the UI
 * can tell "hasn't set up a storefront yet" from "has one with all-default values").
 */
export interface CoachProfile {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  specialties: string[];
  location: string | null;
  coachingMode: CoachingMode;
  /** IANA zone, e.g. "America/Chicago". */
  timeZone: string;
  completed: boolean;
}

/** PATCH /api/coach/profile request body — always the full profile, not a partial patch. */
export interface UpdateCoachProfileRequest {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  specialties: string[];
  location: string | null;
  coachingMode: CoachingMode;
  timeZone: string;
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

/** POST /api/checkout. */
export interface CreateCheckoutSessionRequest {
  offerId: string;
  clientEmail: string;
  /** App path Stripe returns the client to after paying. Defaults to the coach's storefront. */
  successPath?: string;
  /** App path Stripe returns the client to if they cancel. Defaults to the coach's storefront. */
  cancelPath?: string;
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
  includes: string[];
  lengthWeeks: number | null;
  sessionMinutes: number | null;
}

/** PATCH /api/offers/[id] request body — all fields optional, only provided ones change. */
export interface UpdateOfferRequest {
  name?: string;
  description?: string | null;
  active?: boolean;
  includes?: string[];
  lengthWeeks?: number | null;
  sessionMinutes?: number | null;
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

/**
 * Client self-serve auth (Sprint 4). Deliberately scoped to one coach relationship, not a
 * cross-coach client identity — a client who's bought from two coaches logs into each
 * separately. Revisit only if a unified client account becomes an explicit requirement.
 */

/** POST /api/client/login/request request body. */
export interface ClientLoginRequest {
  /** The coach's handle — a client logs into one specific coach relationship, not a global account. */
  handle: string;
  email: string;
}

/** GET /api/client/me. */
export interface ClientMeResponse {
  client: { email: string; name: string | null };
  coach: { handle: string; displayName: string };
}

/**
 * Sprint 4 — recurring billing, dunning, pause. Mirrors schema.ts's `subscription_status` enum;
 * kept as its own string union here (not imported from the DB schema) since this file has no
 * runtime dependency on the database — see the file header.
 */
export type SubscriptionStatus = 'incomplete' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled';

export type PauseReason = 'vacation' | 'injury' | 'other';

/** One row in GET /api/client/subscriptions. */
export interface ClientSubscriptionSummary {
  id: string;
  offerName: string;
  price: OfferPrice;
  status: SubscriptionStatus;
  /** ISO timestamp, or null if unknown (e.g. before the first invoice). */
  currentPeriodEnd: string | null;
  /** Set only while `status === 'paused'`. */
  pauseResumesAt: string | null;
  pauseReason: PauseReason | null;
}

/**
 * One row in GET /api/client/subscriptions' `purchases` — a one-time (program/session) purchase.
 * Has no ongoing status to manage: no pause, cancel, or next-charge date, since nothing recurs.
 */
export interface ClientPurchaseSummary {
  id: string;
  offerName: string;
  currency: string;
  amountCents: number;
  purchasedAt: string;
}

export interface ClientSubscriptionsResponse {
  subscriptions: ClientSubscriptionSummary[];
  purchases: ClientPurchaseSummary[];
}

/** POST /api/client/subscriptions/[id]/pause request body. */
export interface PauseSubscriptionRequest {
  reason: PauseReason;
  /** ISO date (yyyy-mm-dd) — must be in the future. Billing resumes automatically on this date. */
  resumeDate: string;
}

/** POST /api/client/portal — a Stripe Customer Portal session for updating the payment method. */
export interface ClientPortalResponse {
  url: string;
}

/** One row in GET /api/coach/clients — one per subscription, not per client (a client with two
 * subscriptions to the same coach appears twice, once per subscription). */
export interface CoachClientSummary {
  clientId: string;
  clientEmail: string;
  clientName: string | null;
  subscriptionId: string;
  offerName: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  pauseResumesAt: string | null;
  pauseReason: PauseReason | null;
}

/** One row in GET /api/coach/clients' `purchases` — a one-time purchase, listed separately from
 * `clients` (subscriptions only) since it has no status/pause/resume state to show. */
export interface CoachPurchaseSummary {
  id: string;
  clientId: string;
  clientEmail: string;
  clientName: string | null;
  offerName: string;
  currency: string;
  amountCents: number;
  purchasedAt: string;
}

export interface CoachClientsResponse {
  clients: CoachClientSummary[];
  purchases: CoachPurchaseSummary[];
}
