import {
  createAccountLink,
  fetchOnboardingStatus,
  isPayoutsReady,
  NOT_STARTED,
  PAYOUT_STEPS,
  requirementLabel,
  requirementLabels,
  STATUS_COPY,
  stepIndex,
} from './payouts';

const READY = { status: 'ready' as const, chargesEnabled: true, payoutsEnabled: true, requirementsDue: [] };

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
    expect(isPayoutsReady(READY)).toBe(true);
    expect(isPayoutsReady(NOT_STARTED)).toBe(false);
    expect(isPayoutsReady({ ...READY, payoutsEnabled: false })).toBe(false);
    expect(isPayoutsReady({ ...READY, chargesEnabled: false })).toBe(false);
  });
});

describe('fetchOnboardingStatus / createAccountLink (fetch wrappers)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchJson(body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
  }

  it('fetchOnboardingStatus() returns ok:true with the status on success', async () => {
    mockFetchJson({ success: true, message: 'Onboarding status loaded.', data: READY });
    const result = await fetchOnboardingStatus();
    expect(result).toEqual({ ok: true, status: READY });
    expect(global.fetch).toHaveBeenCalledWith('/api/coach/onboarding-status', { method: 'GET', headers: undefined, body: undefined });
  });

  it('fetchOnboardingStatus() returns ok:false with the backend message on failure', async () => {
    mockFetchJson({ success: false, code: 'NOT_AUTHENTICATED', message: 'You are not logged in.' });
    const result = await fetchOnboardingStatus();
    expect(result).toEqual({ ok: false, message: 'You are not logged in.' });
  });

  it('createAccountLink() posts the return/refresh paths and returns the url on success', async () => {
    mockFetchJson({ success: true, message: 'Account link created.', data: { url: 'https://connect.stripe.com/x' } });
    const result = await createAccountLink({ returnPath: '/business/payouts/return', refreshPath: '/business/payouts/connect' });
    expect(result).toEqual({ ok: true, url: 'https://connect.stripe.com/x' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/coach/connect/account-link',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ returnPath: '/business/payouts/return', refreshPath: '/business/payouts/connect' }),
      }),
    );
  });

  it('createAccountLink() returns ok:false with the backend message on failure', async () => {
    mockFetchJson({ success: false, code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
    const result = await createAccountLink({});
    expect(result).toEqual({ ok: false, message: 'Something went wrong. Please try again.' });
  });
});
