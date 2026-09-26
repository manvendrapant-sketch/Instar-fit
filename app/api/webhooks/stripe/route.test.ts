import { POST } from '@/app/api/webhooks/stripe/route';
import { getStripe } from '@/lib/stripe/client';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/stripe/client');
jest.mock('@/lib/commerce/db');

const FAKE_EVENT = { id: 'evt_123', type: 'account.updated' };

function webhookRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers, body });
}

function mockDbInsert(returningResult: unknown[]) {
  const returning = jest.fn().mockResolvedValue(returningResult);
  const onConflictDoNothing = jest.fn().mockReturnValue({ returning });
  const values = jest.fn().mockReturnValue({ onConflictDoNothing });
  (getDb as jest.Mock).mockReturnValue({ insert: jest.fn().mockReturnValue({ values }) });
  return { values, onConflictDoNothing, returning };
}

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, STRIPE_WEBHOOK_SECRET: 'whsec_test' };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('POST /api/webhooks/stripe', () => {
  it('returns 500 when the stripe-signature header is missing', async () => {
    const res = await POST(webhookRequest('{}'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Webhook not configured' });
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not set, even with a signature header', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));
    expect(res.status).toBe(500);
  });

  it('returns 400 when signature verification fails', async () => {
    (getStripe as jest.Mock).mockReturnValue({
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('bad signature');
        }),
      },
    });

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Signature verification failed: bad signature' });
  });

  it('verifies with the raw body, signature header, and configured secret', async () => {
    const constructEvent = jest.fn().mockReturnValue(FAKE_EVENT);
    (getStripe as jest.Mock).mockReturnValue({ webhooks: { constructEvent } });
    mockDbInsert([{ id: 'row-1' }]);

    await POST(webhookRequest('{"id":"evt_123"}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(constructEvent).toHaveBeenCalledWith('{"id":"evt_123"}', 't=1,v1=abc', 'whsec_test');
  });

  it('stores a new event and returns 200 { received: true }', async () => {
    (getStripe as jest.Mock).mockReturnValue({ webhooks: { constructEvent: jest.fn().mockReturnValue(FAKE_EVENT) } });
    const { values } = mockDbInsert([{ id: 'row-1' }]);

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(values).toHaveBeenCalledWith({ stripeEventId: 'evt_123', type: 'account.updated', payload: FAKE_EVENT });
  });

  it('dedupes a retried delivery: onConflictDoNothing returns no rows, still 200', async () => {
    (getStripe as jest.Mock).mockReturnValue({ webhooks: { constructEvent: jest.fn().mockReturnValue(FAKE_EVENT) } });
    mockDbInsert([]); // empty = the unique index already had this stripeEventId

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, duplicate: true });
  });
});
