import { createCheckoutSessionApi } from './checkout';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
}

describe('createCheckoutSessionApi', () => {
  it('posts offerId/clientEmail and returns the checkoutUrl on success', async () => {
    mockFetch({ success: true, message: 'Checkout session created.', data: { checkoutUrl: 'https://checkout.stripe.com/pay/123' } });

    const result = await createCheckoutSessionApi('offer-1', 'client@example.com');

    expect(global.fetch).toHaveBeenCalledWith('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: 'offer-1', clientEmail: 'client@example.com' }),
    });
    expect(result).toEqual({ ok: true, checkoutUrl: 'https://checkout.stripe.com/pay/123' });
  });

  it('surfaces a field-level email error separately from the general message', async () => {
    mockFetch({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Please fix the highlighted fields and try again.',
      fields: { clientEmail: 'Enter a valid email address.' },
    });

    const result = await createCheckoutSessionApi('offer-1', 'not-an-email');

    expect(result).toEqual({
      ok: false,
      message: 'Please fix the highlighted fields and try again.',
      emailError: 'Enter a valid email address.',
    });
  });

  it('returns a plain failure with no emailError for a non-field failure (e.g. NOT_READY)', async () => {
    mockFetch({ success: false, code: 'NOT_READY', message: 'This coach is not ready to accept payments yet.' });

    const result = await createCheckoutSessionApi('offer-1', 'client@example.com');

    expect(result).toEqual({ ok: false, message: 'This coach is not ready to accept payments yet.', emailError: undefined });
  });

  it('never throws when fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;

    const result = await createCheckoutSessionApi('offer-1', 'client@example.com');

    expect(result).toEqual({ ok: false, message: 'Something went wrong. Please try again.' });
  });
});
