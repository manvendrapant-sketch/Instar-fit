import { POST } from '@/app/api/webhooks/stripe/route';
import { getStripe } from '@/lib/stripe/client';
import { getDb } from '@/lib/commerce/db';
import { dispatchWebhookEvent } from '@/lib/commerce/webhookHandlers';

jest.mock('@/lib/stripe/client');
jest.mock('@/lib/commerce/db');
jest.mock('@/lib/commerce/webhookHandlers');

const FAKE_EVENT = { id: 'evt_123', type: 'account.updated' };

function webhookRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers, body });
}

/** Wires up getDb() with insert/query/update chains a test can control per call. */
function mockDb(opts: { insertReturning: unknown[]; existingRow?: { id: string; processedAt: Date | null } | null }) {
  const insertReturning = jest.fn().mockResolvedValue(opts.insertReturning);
  const onConflictDoNothing = jest.fn().mockReturnValue({ returning: insertReturning });
  const insertValues = jest.fn().mockReturnValue({ onConflictDoNothing });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  const findFirst = jest.fn().mockResolvedValue(opts.existingRow ?? null);

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  (getDb as jest.Mock).mockReturnValue({
    insert,
    query: { webhookEvents: { findFirst } },
    update,
  });

  return { insertValues, findFirst, updateSet, updateWhere };
}

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, STRIPE_WEBHOOK_SECRET: 'whsec_test' };
  (getStripe as jest.Mock).mockReturnValue({ webhooks: { constructEvent: jest.fn().mockReturnValue(FAKE_EVENT) } });
  (dispatchWebhookEvent as jest.Mock).mockResolvedValue(undefined);
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
    mockDb({ insertReturning: [{ id: 'row-1', processedAt: null }] });

    await POST(webhookRequest('{"id":"evt_123"}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(constructEvent).toHaveBeenCalledWith('{"id":"evt_123"}', 't=1,v1=abc', 'whsec_test');
  });

  it('stores a new event, dispatches it, marks it processed, and returns 200', async () => {
    const { insertValues, updateSet, updateWhere } = mockDb({ insertReturning: [{ id: 'row-1', processedAt: null }] });

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(insertValues).toHaveBeenCalledWith({ stripeEventId: 'evt_123', type: 'account.updated', payload: FAKE_EVENT });
    expect(dispatchWebhookEvent).toHaveBeenCalledWith(expect.anything(), FAKE_EVENT, 'http://localhost');
    expect(updateSet).toHaveBeenCalledWith({ processedAt: expect.any(Date) });
    expect(updateWhere).toHaveBeenCalled();
  });

  it('skips a genuine duplicate delivery (already processed) without dispatching again', async () => {
    mockDb({ insertReturning: [], existingRow: { id: 'row-1', processedAt: new Date('2026-01-01') } });

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('reprocesses a retried delivery whose earlier attempt crashed before processedAt was set', async () => {
    const { updateSet } = mockDb({ insertReturning: [], existingRow: { id: 'row-1', processedAt: null } });

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(dispatchWebhookEvent).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith({ processedAt: expect.any(Date) });
  });

  it('returns 500 and never marks the event processed when the handler throws', async () => {
    const { updateSet } = mockDb({ insertReturning: [{ id: 'row-1', processedAt: null }] });
    (dispatchWebhookEvent as jest.Mock).mockRejectedValue(new Error('boom'));

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Webhook processing failed' });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it('returns a real 500 response instead of crashing uncaught when the bookkeeping insert itself throws', async () => {
    // Confirmed 2026-09-28: this step wasn't wrapped in try/catch, so a transient DB error here
    // crashed the whole Route Handler with Next's bare framework 500 (no JSON body) instead of a
    // proper error response — exactly the "Internal Server Error" a real delivery showed.
    const insert = jest.fn().mockImplementation(() => {
      throw new Error('connection reset');
    });
    (getDb as jest.Mock).mockReturnValue({ insert, query: { webhookEvents: { findFirst: jest.fn() } }, update: jest.fn() });

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Webhook processing failed' });
    expect(dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('returns a real 500 response instead of crashing uncaught when the final processedAt update throws', async () => {
    const { updateSet } = mockDb({ insertReturning: [{ id: 'row-1', processedAt: null }] });
    updateSet.mockReturnValue({
      where: jest.fn().mockImplementation(() => {
        throw new Error('connection reset');
      }),
    });

    const res = await POST(webhookRequest('{}', { 'stripe-signature': 't=1,v1=abc' }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Webhook processing failed' });
  });
});
