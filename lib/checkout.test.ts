import { createCheckoutSessionApi, fetchCheckoutQuote } from './checkout';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
}

describe('fetchCheckoutQuote', () => {
  it('requests the offer by id and returns the breakdown on success', async () => {
    mockFetch({
      success: true,
      message: 'Quote computed.',
      data: {
        offer: { id: 'offer-1' },
        breakdown: { currency: 'usd', baseAmountCents: 10000, serviceFeeCents: 300, totalAmountCents: 10300 },
      },
    });

    const result = await fetchCheckoutQuote('offer-1');

    expect(global.fetch).toHaveBeenCalledWith('/api/checkout/quote?offerId=offer-1', expect.objectContaining({ method: 'GET' }));
    expect(result).toEqual({
      ok: true,
      breakdown: { currency: 'usd', baseAmountCents: 10000, serviceFeeCents: 300, totalAmountCents: 10300 },
    });
  });

  it('URL-encodes the offer id', async () => {
    mockFetch({ success: false, code: 'NOT_FOUND', message: 'This offer is not available.' });
    await fetchCheckoutQuote('offer with spaces');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/checkout/quote?offerId=offer%20with%20spaces',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns a plain failure when the offer is not found', async () => {
    mockFetch({ success: false, code: 'NOT_FOUND', message: 'This offer is not available.' });
    const result = await fetchCheckoutQuote('offer-1');
    expect(result).toEqual({ ok: false, message: 'This offer is not available.' });
  });

  it('never throws when fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;
    const result = await fetchCheckoutQuote('offer-1');
    expect(result).toEqual({ ok: false, message: 'Something went wrong. Please try again.' });
  });
});

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
