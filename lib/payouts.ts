import { apiFetch } from './api-client';
import type { ConnectStatus, CreateAccountLinkRequest, CreateAccountLinkResponse, OnboardingStatus } from './commerce/types';

// Connect payouts. The coach's bank, ID and tax details are collected by Stripe's hosted Express
// onboarding, never by Instar — this app only shows OnboardingStatus
// (GET /api/coach/onboarding-status) and sends the coach to Stripe
// (POST /api/coach/connect/account-link).

export const PAYOUTS_PATH = '/business/payouts';
export const PAYOUTS_CONNECT_PATH = '/business/payouts/connect';
/** Where Stripe sends the coach back to (the account link's return_url / refresh_url). */
export const PAYOUTS_RETURN_PATH = '/business/payouts/return';

export const NOT_STARTED: OnboardingStatus = {
  status: 'not_started',
  chargesEnabled: false,
  payoutsEnabled: false,
  requirementsDue: [],
};

export const STATUS_COPY: Record<ConnectStatus, { chip: string; title: string; body: string }> = {
  not_started: {
    chip: 'Not connected',
    title: 'Connect payouts to get paid',
    body: 'Add your bank account on Stripe’s secure page so client payments reach you. It takes about 5 minutes.',
  },
  action_needed: {
    chip: 'Action needed',
    title: 'Stripe needs a few more details',
    body: 'Clients can’t pay you until these are done. Pick up where you left off; it only asks for what’s missing.',
  },
  pending_review: {
    chip: 'In review',
    title: 'Stripe is checking your details',
    body: 'This usually takes a few minutes and can take up to 2 business days. Keep building your storefront and offers meanwhile.',
  },
  ready: {
    chip: 'Ready',
    title: 'Payouts are on',
    body: 'Clients can pay you, and Stripe sends the money to your bank automatically.',
  },
};

/** Steps shown in the progress bar, in order. */
export const PAYOUT_STEPS: { key: ConnectStatus; label: string }[] = [
  { key: 'not_started', label: 'Connect' },
  { key: 'action_needed', label: 'Your details' },
  { key: 'pending_review', label: 'Stripe review' },
  { key: 'ready', label: 'Ready' },
];

/** Index of the current step; action_needed and not_started both sit before review. */
export function stepIndex(status: ConnectStatus): number {
  return status === 'not_started' ? 0 : status === 'action_needed' ? 1 : status === 'pending_review' ? 2 : 3;
}

// Stripe's `requirements.currently_due` keys → what to tell a coach. Unknown keys fall back to a
// readable version of the key itself, so a new Stripe requirement never renders as blank.
const REQUIREMENT_LABELS: Record<string, string> = {
  external_account: 'Bank account for payouts',
  'individual.verification.document': 'Photo ID (driver’s license or passport)',
  'individual.verification.additional_document': 'A second document to confirm your address',
  'individual.ssn_last_4': 'Last 4 digits of your SSN',
  'individual.id_number': 'Full SSN or tax ID',
  'individual.dob.day': 'Date of birth',
  'individual.dob.month': 'Date of birth',
  'individual.dob.year': 'Date of birth',
  'individual.address.line1': 'Home address',
  'individual.address.city': 'Home address',
  'individual.address.postal_code': 'Home address',
  'individual.phone': 'Phone number',
  'individual.email': 'Email address',
  'business_profile.url': 'A website or social profile for your coaching',
  'business_profile.mcc': 'What kind of business you run',
  'tos_acceptance.date': 'Accept Stripe’s terms',
  'tos_acceptance.ip': 'Accept Stripe’s terms',
};

export function requirementLabel(key: string): string {
  if (REQUIREMENT_LABELS[key]) return REQUIREMENT_LABELS[key];
  const last = key.split('.').pop() ?? key;
  const words = last.replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

/** Friendly labels for what's due, de-duplicated (DOB day/month/year become one line). */
export function requirementLabels(keys: string[]): string[] {
  return [...new Set(keys.map(requirementLabel))];
}

export function isPayoutsReady(s: OnboardingStatus): boolean {
  return s.status === 'ready' && s.chargesEnabled && s.payoutsEnabled;
}

// --- Backend calls -----------------------------------------------------------------------

export async function fetchOnboardingStatus(): Promise<{ ok: true; status: OnboardingStatus } | { ok: false; message: string }> {
  const result = await apiFetch<OnboardingStatus>('/api/coach/onboarding-status');
  if (result.success) return { ok: true, status: result.data };
  return { ok: false, message: result.message };
}

/** Creates (or reuses) the coach's Stripe Express account and returns the onboarding link to redirect to. */
export async function createAccountLink(
  request: CreateAccountLinkRequest,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const result = await apiFetch<CreateAccountLinkResponse>('/api/coach/connect/account-link', {
    method: 'POST',
    body: request,
  });
  if (result.success) return { ok: true, url: result.data.url };
  return { ok: false, message: result.message };
}
