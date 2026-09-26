import type { ConnectStatus } from './types';

interface ConnectFlags {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
}

/**
 * Stripe has no single "status" field on an Express account — this is the one place that maps
 * its own flags onto our coarser four-state `ConnectStatus`, so onboarding-status and the
 * storefront-publish readiness gate can never drift apart. `undefined` means no connected_accounts
 * row exists yet (the coach hasn't started Connect onboarding at all).
 */
export function deriveConnectStatus(account: ConnectFlags | undefined): ConnectStatus {
  if (!account) return 'not_started';
  if (account.chargesEnabled && account.payoutsEnabled) return 'ready';
  if (account.requirementsDue.length > 0) return 'action_needed';
  if (account.detailsSubmitted) return 'pending_review';
  return 'action_needed';
}
