import { clientLogout, fetchClientMe, requestClientLoginLink } from './clientAuth';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
}

describe('requestClientLoginLink', () => {
  it('posts handle/email and resolves ok:true on success', async () => {
    mockFetch({ success: true, message: "If an account exists for that email, we've sent a login link.", data: null });
    const result = await requestClientLoginLink('maya-reyes', 'client@example.com');
    expect(global.fetch).toHaveBeenCalledWith('/api/client/login/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'maya-reyes', email: 'client@example.com' }),
    });
    expect(result).toEqual({ ok: true, message: "If an account exists for that email, we've sent a login link." });
  });

  it('never throws when fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;
    const result = await requestClientLoginLink('maya-reyes', 'client@example.com');
    expect(result).toEqual({ ok: false, message: 'Something went wrong. Please try again.' });
  });
});

describe('clientLogout', () => {
  it('posts to /api/client/logout', async () => {
    mockFetch({ success: true, message: 'Logged out.', data: null });
    await clientLogout();
    expect(global.fetch).toHaveBeenCalledWith('/api/client/logout', expect.objectContaining({ method: 'POST' }));
  });
});

describe('fetchClientMe', () => {
  it('returns the client/coach data on success', async () => {
    const data = { client: { email: 'client@example.com', name: 'Alex' }, coach: { handle: 'maya-reyes', displayName: 'Maya Reyes' } };
    mockFetch({ success: true, message: 'Loaded.', data });
    const result = await fetchClientMe();
    expect(result).toEqual({ ok: true, data });
  });

  it('returns ok:false with the backend message on failure', async () => {
    mockFetch({ success: false, code: 'NOT_AUTHENTICATED', message: 'You are not logged in.' });
    const result = await fetchClientMe();
    expect(result).toEqual({ ok: false, message: 'You are not logged in.' });
  });
});
