import {
  isMockResult,
  isPayoutsReady,
  MOCK_READY,
  mockStatusAfter,
  NOT_STARTED,
  PAYOUT_STEPS,
  requirementLabel,
  requirementLabels,
  STATUS_COPY,
  stepIndex,
} from './payouts';

describe('steps', () => {
  it('orders the four statuses and has copy for each', () => {
    expect(PAYOUT_STEPS.map((s) => s.key)).toEqual(['not_started', 'action_needed', 'pending_review', 'ready']);
    for (const s of PAYOUT_STEPS) {
      expect(STATUS_COPY[s.key].title).toBeTruthy();
      expect(stepIndex(s.key)).toBe(PAYOUT_STEPS.indexOf(s));
    }
  });
});

describe('requirementLabel', () => {
  it('translates known Stripe requirement keys', () => {
    expect(requirementLabel('external_account')).toBe('Bank account for payouts');
    expect(requirementLabel('individual.verification.document')).toMatch(/Photo ID/);
  });

  it('falls back to a readable version of unknown keys, never blank', () => {
    expect(requirementLabel('individual.political_exposure')).toBe('Political exposure');
    expect(requirementLabel('company')).toBe('Company');
  });

  it('merges keys that mean the same thing', () => {
    expect(requirementLabels(['individual.dob.day', 'individual.dob.month', 'individual.dob.year', 'external_account'])).toEqual([
      'Date of birth',
      'Bank account for payouts',
    ]);
  });
});

describe('isPayoutsReady', () => {
  it('needs the ready status and both capabilities', () => {
    expect(isPayoutsReady(MOCK_READY)).toBe(true);
    expect(isPayoutsReady(NOT_STARTED)).toBe(false);
    expect(isPayoutsReady({ ...MOCK_READY, payoutsEnabled: false })).toBe(false);
    expect(isPayoutsReady({ ...MOCK_READY, chargesEnabled: false })).toBe(false);
  });
});

describe('mock Stripe outcomes', () => {
  it('maps each outcome to a consistent status', () => {
    expect(mockStatusAfter('finished').status).toBe('pending_review');
    expect(mockStatusAfter('verified')).toEqual(MOCK_READY);
    const early = mockStatusAfter('left_early');
    expect(early.status).toBe('action_needed');
    expect(early.requirementsDue.length).toBeGreaterThan(0);
    expect(early.chargesEnabled || early.payoutsEnabled).toBe(false);
  });

  it('recognises valid outcomes only', () => {
    expect(isMockResult('finished')).toBe(true);
    expect(isMockResult('hacked')).toBe(false);
    expect(isMockResult(undefined)).toBe(false);
  });
});
