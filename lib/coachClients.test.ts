import { fetchCoachClients, STATUS_LABEL } from './coachClients';

describe('STATUS_LABEL', () => {
  it('has a label for every SubscriptionStatus value', () => {
    for (const status of ['incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled'] as const) {
      expect(STATUS_LABEL[status].label).toBeTruthy();
    }
  });
});

describe('fetchCoachClients', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchOnce(body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
  }

  it('returns ok:true with the clients list on success', async () => {
    mockFetchOnce({ success: true, message: 'Loaded.', data: { clients: [{ clientId: 'client-1' }] } });
    const result = await fetchCoachClients();
    expect(result).toEqual({ ok: true, clients: [{ clientId: 'client-1' }] });
    expect(global.fetch).toHaveBeenCalledWith('/api/coach/clients', { method: 'GET', headers: undefined, body: undefined });
  });

  it('returns ok:false with the backend message on failure', async () => {
    mockFetchOnce({ success: false, code: 'NOT_AUTHENTICATED', message: 'You are not logged in.' });
    const result = await fetchCoachClients();
    expect(result).toEqual({ ok: false, message: 'You are not logged in.' });
  });
});
