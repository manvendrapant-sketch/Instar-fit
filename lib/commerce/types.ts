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

/** POST /api/coach/connect/dashboard-link — a one-time-use link into the coach's own Stripe
 * Express dashboard (their view: balance, payout history, bank details), not the platform's own
 * Stripe Dashboard. Requires payouts to already be connected. */
export interface DashboardLinkResponse {
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

/**
 * Sprint 5 — refunds, disputes, payouts. Balance and payout data come live from Stripe Connect,
 * not Instar's own ledger (see Decisions.md) — these types describe what those live reads look
 * like once shaped for the frontend, not a DB row.
 */

/** GET /api/coach/balance. `earnedThisMonthCents`/`earnedLastMonthCents` are the one number Stripe
 * itself doesn't track for us — summed from our own `payments`/`refunds` rows, net of Instar's
 * platform fee and any refunds (what actually reaches the coach), for the given calendar month. */
export interface CoachBalanceResponse {
  currency: string;
  availableCents: number;
  pendingCents: number;
  earnedThisMonthCents: number;
  earnedLastMonthCents: number;
}

export type PayoutInterval = 'daily' | 'weekly' | 'monthly' | 'manual';

/** GET /api/coach/payout-schedule — part of the coach's Stripe Express account settings.
 * `weeklyAnchor`/`monthlyAnchor` are only meaningful for the matching `interval` (Stripe leaves the
 * other one unset); null otherwise. */
export interface PayoutScheduleResponse {
  interval: PayoutInterval;
  delayDays: number;
  weeklyAnchor: string | null;
  monthlyAnchor: number | null;
}

export type PayoutStatus = 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';

/** One row in GET /api/coach/payouts — read live from Stripe, not our `payouts` table. */
export interface CoachPayoutSummary {
  id: string;
  currency: string;
  amountCents: number;
  status: PayoutStatus;
  arrivalDate: string;
  createdAt: string;
}

export interface CoachPayoutsResponse {
  payouts: CoachPayoutSummary[];
  /** True if Stripe has more payouts than this page returned (pagination isn't built yet — see CLAUDE.md). */
  hasMore: boolean;
}

export type PaymentStatus = 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | 'disputed';

/** One row in GET /api/coach/payments. `netCents` is what the coach keeps after Instar's platform
 * fee and any refunds — server-computed, per the standing "never compute money in the browser"
 * rule, same as everywhere else in this file. */
export interface CoachPaymentSummary {
  id: string;
  clientName: string | null;
  clientEmail: string;
  offerName: string;
  currency: string;
  totalAmountCents: number;
  netCents: number;
  refundedAmountCents: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface CoachPaymentsResponse {
  payments: CoachPaymentSummary[];
}

/** GET /api/coach/payments/[id]/refund-quote?amountCents= — the refund confirmation's preview,
 * computed the same way Stripe itself will split the real refund (see Decisions.md). */
export interface RefundQuoteResponse {
  currency: string;
  /** What Stripe will actually let this refund be, capped at what hasn't been refunded already. */
  maxRefundableCents: number;
  /** What the client gets back on their card — always equal to the requested amount. */
  clientReceivesCents: number;
  /** Instar's platform fee reversed, proportional to the refund amount. */
  platformFeeReversedCents: number;
  /** How much less the coach's Stripe balance holds as a result of this refund. */
  coachBalanceImpactCents: number;
}

/** POST /api/coach/payments/[id]/refund request body. */
export interface RefundPaymentRequest {
  amountCents: number;
  reason?: string;
}

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

/** POST /api/coach/payments/[id]/refund response — the refund as Stripe reports it back
 * immediately; the persistent `refunds` row itself is written by the `charge.refunded` webhook,
 * same "webhook is the one writer of ledger rows" convention as every other payment in this app. */
export interface RefundPaymentResponse {
  id: string;
  status: RefundStatus;
  amountCents: number;
}

/**
 * A curated subset of Stripe's ~25 dispute evidence fields — not all of them, to keep the coach
 * form manageable for v1. File fields hold a Stripe file id (from POST .../files), not raw content.
 */
export interface DisputeEvidenceFields {
  customerName: string | null;
  customerEmailAddress: string | null;
  customerPurchaseIp: string | null;
  productDescription: string | null;
  billingAddress: string | null;
  refundPolicyDisclosure: string | null;
  refundRefusalExplanation: string | null;
  cancellationPolicyDisclosure: string | null;
  cancellationRebuttal: string | null;
  serviceDate: string | null;
  uncategorizedText: string | null;
  /** Stripe file id for the coach's communication with the client (email threads, etc.). */
  customerCommunication: string | null;
  /** Stripe file id for proof of service (a signed contract, work order, etc.). */
  serviceDocumentation: string | null;
  /** Stripe file id for anything that doesn't fit the categories above. */
  uncategorizedFile: string | null;
}

/** One row in GET /api/coach/disputes. */
export interface CoachDisputeSummary {
  id: string;
  paymentId: string;
  clientName: string | null;
  clientEmail: string;
  offerName: string;
  currency: string;
  amountCents: number;
  reason: string;
  /** Mirrors Stripe's own dispute status strings verbatim (e.g. needs_response, under_review, won, lost). */
  status: string;
  evidenceDueBy: string | null;
  createdAt: string;
}

export interface CoachDisputesResponse {
  disputes: CoachDisputeSummary[];
}

/** GET /api/coach/disputes/[id] — the summary plus what's needed to actually respond. */
export interface CoachDisputeDetailResponse extends CoachDisputeSummary {
  evidence: DisputeEvidenceFields;
  /** Which of `DisputeEvidenceFields`' keys are actually relevant for this dispute's reason code —
   * a curated mapping (see lib/commerce/disputes.ts), not something Stripe's API returns directly. */
  acceptedEvidenceFields: (keyof DisputeEvidenceFields)[];
  /** How many times evidence has been submitted — Stripe normally only allows once. */
  submissionCount: number;
  /** True if the last submission landed after evidenceDueBy — delivery isn't guaranteed. */
  pastDue: boolean;
}

/** PATCH (save draft) and POST (submit) /api/coach/disputes/[id]/evidence request body — every
 * field optional, only the ones provided are updated (mirrors PATCH /api/offers/[id]'s pattern). */
export type SaveDisputeEvidenceRequest = Partial<DisputeEvidenceFields>;

/** POST /api/coach/disputes/[id]/files (multipart/form-data, field name "file") response. */
export interface UploadEvidenceFileResponse {
  fileId: string;
}
