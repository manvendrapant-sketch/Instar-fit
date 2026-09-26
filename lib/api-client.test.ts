import { apiFetch } from './api-client';

describe('apiFetch', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('defaults to a GET request with no body/headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ success: true, message: 'ok', data: 1 }) }) as typeof fetch;
    const result = await apiFetch('/api/offers');
    expect(global.fetch).toHaveBeenCalledWith('/api/offers', { method: 'GET', headers: undefined, body: undefined });
    expect(result).toEqual({ success: true, message: 'ok', data: 1 });
  });

  it('sends a JSON body and Content-Type header for a write', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ success: true, message: 'ok', data: null }) }) as typeof fetch;
    await apiFetch('/api/offers', { method: 'POST', body: { name: 'Kickoff' } });
    expect(global.fetch).toHaveBeenCalledWith('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kickoff' }),
    });
  });

  it('resolves to a NETWORK_ERROR result instead of throwing when fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;
    const result = await apiFetch('/api/offers');
    expect(result).toEqual({ success: false, code: 'NETWORK_ERROR', message: 'Something went wrong. Please try again.' });
  });

  it('resolves to a NETWORK_ERROR result instead of throwing when the response body is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.reject(new SyntaxError('Unexpected token')) }) as typeof fetch;
    const result = await apiFetch('/api/offers');
    expect(result).toEqual({ success: false, code: 'NETWORK_ERROR', message: 'Something went wrong. Please try again.' });
  });
});
