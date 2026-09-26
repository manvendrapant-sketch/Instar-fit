import { deriveConnectStatus } from './connect';

describe('deriveConnectStatus', () => {
  it('returns not_started when no connected_accounts row exists', () => {
    expect(deriveConnectStatus(undefined)).toBe('not_started');
  });

  it('returns ready when both charges and payouts are enabled', () => {
    expect(
      deriveConnectStatus({ chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, requirementsDue: [] }),
    ).toBe('ready');
  });

  it('returns action_needed when Stripe still lists requirements due', () => {
    expect(
      deriveConnectStatus({
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: true,
        requirementsDue: ['individual.id_number'],
      }),
    ).toBe('action_needed');
  });

  it('returns pending_review once details are submitted with no requirements outstanding but not yet enabled', () => {
    expect(
      deriveConnectStatus({ chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: true, requirementsDue: [] }),
    ).toBe('pending_review');
  });

  it('returns action_needed for a freshly created account (nothing submitted yet)', () => {
    expect(
      deriveConnectStatus({ chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, requirementsDue: [] }),
    ).toBe('action_needed');
  });
});
