import {
  dispatchWebhookEvent,
  handleCheckoutSessionCompleted,
  handleCustomerUpdated,
  handleInvoicePaid,
  handleInvoicePaymentActionRequired,
  handleInvoicePaymentFailed,
  handlePaymentIntentSucceeded,
  handleSubscriptionSynced,
} from './webhookHandlers';
import { upsertClient } from './clients';
import { getStripe } from '@/lib/stripe/client';
import { generateLoginToken, hashLoginToken } from '@/lib/auth/clientToken';
import { sendDunningEmail } from '@/lib/email/send';

jest.mock('./clients');
jest.mock('@/lib/stripe/client');
jest.mock('@/lib/auth/clientToken');
jest.mock('@/lib/email/send');

function mockDb(opts: {
  subscriptionFindFirst?: unknown;
  priceFindFirst?: unknown;
  clientFindFirst?: unknown;
  offerFindFirst?: unknown;
  coachFindFirst?: unknown;
  insertReturning?: unknown[];
}) {
  const subFindFirst = jest.fn().mockResolvedValue(opts.subscriptionFindFirst ?? null);
  const priceFindFirst = jest.fn().mockResolvedValue(opts.priceFindFirst ?? null);
  const clientFindFirst = jest.fn().mockResolvedValue(opts.clientFindFirst ?? null);
  const offerFindFirst = jest.fn().mockResolvedValue(opts.offerFindFirst ?? null);
  const coachFindFirst = jest.fn().mockResolvedValue(opts.coachFindFirst ?? null);

  const onConflictDoNothing = jest.fn().mockReturnValue(Promise.resolve(opts.insertReturning ?? []));
  const insertValues = jest.fn().mockReturnValue({ onConflictDoNothing });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  const db = {
    query: {
      subscriptions: { findFirst: subFindFirst },
      prices: { findFirst: priceFindFirst },
      clients: { findFirst: clientFindFirst },
      offers: { findFirst: offerFindFirst },
      coaches: { findFirst: coachFindFirst },
    },
    insert,
    update,
  };
  return { db, insert, insertValues, update, updateSet, updateWhere };
}

beforeEach(() => jest.clearAllMocks());

describe('handleCheckoutSessionCompleted', () => {
  it('upserts the client and returns early for a non-subscription session', async () => {
    (upsertClient as jest.Mock).mockResolvedValue({ id: 'client-1' });
    const { db, insert } = mockDb({});

    await handleCheckoutSessionCompleted(db as never, {
      id: 'cs_1',
      mode: 'payment',
      metadata: { coachId: 'coach-1', offerId: 'offer-1' },
      customer_details: { email: 'a@b.com', name: 'Ada' },
      customer: 'cus_1',
      subscription: null,
    } as never);

    expect(upsertClient).toHaveBeenCalledWith(db, {
      coachId: 'coach-1',
      email: 'a@b.com',
      name: 'Ada',
      stripeCustomerId: 'cus_1',
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('skips silently when coachId/offerId/email metadata is missing', async () => {
    const { db } = mockDb({});
    await handleCheckoutSessionCompleted(db as never, {
      id: 'cs_1',
      mode: 'payment',
      metadata: {},
      customer_details: null,
      customer: null,
      subscription: null,
    } as never);
    expect(upsertClient).not.toHaveBeenCalled();
  });

  it('records a subscriptions row for a subscription checkout, using the retrieved Stripe status/period end', async () => {
    (upsertClient as jest.Mock).mockResolvedValue({ id: 'client-1' });
    const { db, insertValues } = mockDb({ priceFindFirst: { id: 'price-1' } });
    const retrieve = jest.fn().mockResolvedValue({
      status: 'active',
      items: { data: [{ current_period_end: 1234567890 }] },
    });
    (getStripe as jest.Mock).mockReturnValue({ subscriptions: { retrieve } });

    await handleCheckoutSessionCompleted(db as never, {
      id: 'cs_1',
      mode: 'subscription',
      metadata: { coachId: 'coach-1', offerId: 'offer-1' },
      customer_details: { email: 'a@b.com', name: 'Ada' },
      customer: 'cus_1',
      subscription: 'sub_1',
    } as never);

    expect(retrieve).toHaveBeenCalledWith('sub_1');
    expect(insertValues).toHaveBeenCalledWith({
      clientId: 'client-1',
      offerId: 'offer-1',
      priceId: 'price-1',
      stripeSubscriptionId: 'sub_1',
      status: 'active',
      currentPeriodEnd: new Date(1234567890 * 1000),
    });
  });

  it('does not re-insert a subscription row that already exists', async () => {
    (upsertClient as jest.Mock).mockResolvedValue({ id: 'client-1' });
    const { db, insert } = mockDb({ subscriptionFindFirst: { id: 'existing' } });

    await handleCheckoutSessionCompleted(db as never, {
      id: 'cs_1',
      mode: 'subscription',
      metadata: { coachId: 'coach-1', offerId: 'offer-1' },
      customer_details: { email: 'a@b.com' },
      customer: 'cus_1',
      subscription: 'sub_1',
    } as never);

    expect(insert).not.toHaveBeenCalled();
  });
});

describe('handlePaymentIntentSucceeded', () => {
  it('writes a payments row using the snapshotted metadata breakdown', async () => {
    (upsertClient as jest.Mock).mockResolvedValue({ id: 'client-1' });
    const { db, insertValues } = mockDb({});

    await handlePaymentIntentSucceeded(db as never, {
      id: 'pi_1',
      currency: 'usd',
      customer: 'cus_1',
      latest_charge: 'ch_1',
      metadata: {
        coachId: 'coach-1',
        offerId: 'offer-1',
        clientEmail: 'a@b.com',
        baseAmountCents: '10000',
        serviceFeeCents: '300',
        platformFeeCents: '200',
        totalAmountCents: '10300',
        currency: 'usd',
      },
    } as never);

    expect(insertValues).toHaveBeenCalledWith({
      coachId: 'coach-1',
      clientId: 'client-1',
      offerId: 'offer-1',
      stripePaymentIntentId: 'pi_1',
      stripeChargeId: 'ch_1',
      currency: 'usd',
      baseAmountCents: 10000,
      serviceFeeCents: 300,
      totalAmountCents: 10300,
      platformFeeCents: 200,
      status: 'succeeded',
    });
  });

  it('is a no-op when checkout metadata is absent (e.g. a subscription invoice PaymentIntent)', async () => {
    const { db, insert } = mockDb({});
    await handlePaymentIntentSucceeded(db as never, { id: 'pi_1', currency: 'usd', metadata: {} } as never);
    expect(upsertClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('handleInvoicePaid', () => {
  const invoiceBase = {
    id: 'in_1',
    parent: { subscription_details: { subscription: 'sub_1' } },
  };

  it('skips a non-subscription invoice', async () => {
    const { db, insert } = mockDb({});
    await handleInvoicePaid(db as never, { id: 'in_1', parent: null } as never);
    expect(insert).not.toHaveBeenCalled();
  });

  it('skips when no subscriptions row exists yet for the Stripe subscription id', async () => {
    const { db, insert } = mockDb({ subscriptionFindFirst: null });
    await handleInvoicePaid(db as never, invoiceBase as never);
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a payments row recomputed from the stored price, and marks the subscription active', async () => {
    const { db, insertValues, updateSet } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', clientId: 'client-1', offerId: 'offer-1', priceId: 'price-1', status: 'incomplete' },
      priceFindFirst: { id: 'price-1', unitAmountCents: 10000, currency: 'usd' },
      clientFindFirst: { id: 'client-1', coachId: 'coach-1' },
    });

    await handleInvoicePaid(db as never, {
      ...invoiceBase,
      payments: { data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_1' } }] },
    } as never);

    expect(insertValues).toHaveBeenCalledWith({
      coachId: 'coach-1',
      clientId: 'client-1',
      offerId: 'offer-1',
      subscriptionId: 'sub-row-1',
      stripePaymentIntentId: 'pi_1',
      stripeChargeId: null,
      currency: 'usd',
      baseAmountCents: 10000,
      serviceFeeCents: 300,
      totalAmountCents: 10300,
      platformFeeCents: 200,
      status: 'succeeded',
    });
    expect(updateSet).toHaveBeenCalledWith({ status: 'active', updatedAt: expect.any(Date) });
  });

  it('does not touch subscription status when it is already active', async () => {
    const { db, update } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', clientId: 'client-1', offerId: 'offer-1', priceId: 'price-1', status: 'active' },
      priceFindFirst: { id: 'price-1', unitAmountCents: 10000, currency: 'usd' },
      clientFindFirst: { id: 'client-1', coachId: 'coach-1' },
    });

    await handleInvoicePaid(db as never, { ...invoiceBase, payments: undefined } as never);

    expect(update).not.toHaveBeenCalled();
  });
});

describe('handleInvoicePaymentFailed / handleInvoicePaymentActionRequired', () => {
  const invoiceBase = {
    id: 'in_1',
    parent: { subscription_details: { subscription: 'sub_1' } },
  };

  it('skips a non-subscription invoice without sending anything', async () => {
    const { db } = mockDb({});
    await handleInvoicePaymentFailed(db as never, { id: 'in_1', parent: null } as never, 'https://instar-fit.vercel.app');
    expect(sendDunningEmail).not.toHaveBeenCalled();
  });

  it('skips when no subscriptions row exists yet', async () => {
    const { db } = mockDb({ subscriptionFindFirst: null });
    await handleInvoicePaymentFailed(db as never, invoiceBase as never, 'https://instar-fit.vercel.app');
    expect(sendDunningEmail).not.toHaveBeenCalled();
  });

  it('mints a fresh login token and emails a "failed" dunning nudge', async () => {
    const { db, insertValues } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', clientId: 'client-1', offerId: 'offer-1' },
      clientFindFirst: { id: 'client-1', email: 'a@b.com', coachId: 'coach-1' },
      offerFindFirst: { id: 'offer-1', name: 'Monthly Coaching' },
      coachFindFirst: { id: 'coach-1', displayName: 'Maya Reyes' },
    });
    (generateLoginToken as jest.Mock).mockReturnValue('raw-token');
    (hashLoginToken as jest.Mock).mockReturnValue('hashed-token');

    await handleInvoicePaymentFailed(db as never, invoiceBase as never, 'https://instar-fit.vercel.app');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1', tokenHash: 'hashed-token' }),
    );
    expect(sendDunningEmail).toHaveBeenCalledWith(
      'a@b.com',
      'https://instar-fit.vercel.app/api/client/login/verify?token=raw-token',
      'Maya Reyes',
      'Monthly Coaching',
      'failed',
    );
  });

  it('emails an "action_required" dunning nudge', async () => {
    const { db } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', clientId: 'client-1', offerId: 'offer-1' },
      clientFindFirst: { id: 'client-1', email: 'a@b.com', coachId: 'coach-1' },
      offerFindFirst: { id: 'offer-1', name: 'Monthly Coaching' },
      coachFindFirst: { id: 'coach-1', displayName: 'Maya Reyes' },
    });
    (generateLoginToken as jest.Mock).mockReturnValue('raw-token');
    (hashLoginToken as jest.Mock).mockReturnValue('hashed-token');

    await handleInvoicePaymentActionRequired(db as never, invoiceBase as never, 'https://instar-fit.vercel.app');

    expect(sendDunningEmail).toHaveBeenCalledWith(
      'a@b.com',
      expect.any(String),
      'Maya Reyes',
      'Monthly Coaching',
      'action_required',
    );
  });

  it('swallows a send failure rather than throwing (so the webhook delivery does not 500/retry)', async () => {
    const { db } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', clientId: 'client-1', offerId: 'offer-1' },
      clientFindFirst: { id: 'client-1', email: 'a@b.com', coachId: 'coach-1' },
      coachFindFirst: { id: 'coach-1', displayName: 'Maya Reyes' },
    });
    (generateLoginToken as jest.Mock).mockReturnValue('raw-token');
    (hashLoginToken as jest.Mock).mockReturnValue('hashed-token');
    (sendDunningEmail as jest.Mock).mockRejectedValue(new Error('resend down'));

    await expect(
      handleInvoicePaymentFailed(db as never, invoiceBase as never, 'https://instar-fit.vercel.app'),
    ).resolves.toBeUndefined();
  });
});

describe('handleSubscriptionSynced', () => {
  it('skips when no subscriptions row exists yet', async () => {
    const { db, update } = mockDb({ subscriptionFindFirst: null });
    await handleSubscriptionSynced(db as never, { id: 'sub_1', status: 'active', items: { data: [] } } as never);
    expect(update).not.toHaveBeenCalled();
  });

  it('syncs status and current_period_end', async () => {
    const { db, updateSet } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', pauseReason: null },
    });

    await handleSubscriptionSynced(db as never, {
      id: 'sub_1',
      status: 'past_due',
      items: { data: [{ current_period_end: 1700000000 }] },
      pause_collection: null,
    } as never);

    expect(updateSet).toHaveBeenCalledWith({
      status: 'past_due',
      currentPeriodEnd: new Date(1700000000 * 1000),
      pauseResumesAt: null,
      pauseReason: null,
      updatedAt: expect.any(Date),
    });
  });

  it('carries pauseReason forward while pause_collection.resumes_at is set', async () => {
    const { db, updateSet } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', pauseReason: 'vacation' },
    });

    await handleSubscriptionSynced(db as never, {
      id: 'sub_1',
      status: 'paused',
      items: { data: [] },
      pause_collection: { resumes_at: 1700000000 },
    } as never);

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paused', pauseResumesAt: new Date(1700000000 * 1000), pauseReason: 'vacation' }),
    );
  });

  it('reports our own status as paused whenever pause_collection is set, even though Stripe leaves its real status as active underneath (confirmed Stripe behavior — see subscriptionSyncFields)', async () => {
    const { db, updateSet } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', pauseReason: 'injury' },
    });

    await handleSubscriptionSynced(db as never, {
      id: 'sub_1',
      status: 'active',
      items: { data: [] },
      pause_collection: { resumes_at: 1700000000 },
    } as never);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused', pauseReason: 'injury' }));
  });

  it('clears a stale pauseReason once pause_collection is gone (resumed)', async () => {
    const { db, updateSet } = mockDb({
      subscriptionFindFirst: { id: 'sub-row-1', pauseReason: 'vacation' },
    });

    await handleSubscriptionSynced(db as never, {
      id: 'sub_1',
      status: 'active',
      items: { data: [] },
      pause_collection: null,
    } as never);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ pauseResumesAt: null, pauseReason: null }));
  });

  it('maps incomplete_expired -> canceled and unpaid -> past_due', async () => {
    const { db, updateSet } = mockDb({ subscriptionFindFirst: { id: 'sub-row-1', pauseReason: null } });
    await handleSubscriptionSynced(db as never, { id: 'sub_1', status: 'unpaid', items: { data: [] } } as never);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'past_due' }));
  });
});

describe('handleCustomerUpdated', () => {
  it('does nothing when no client matches the Stripe customer id', async () => {
    const { db, update } = mockDb({ clientFindFirst: null });
    await handleCustomerUpdated(db as never, { id: 'cus_1', name: 'New Name', email: 'new@b.com' } as never);
    expect(update).not.toHaveBeenCalled();
  });

  it('syncs name and email onto the matching client row', async () => {
    const { db, updateSet, updateWhere } = mockDb({
      clientFindFirst: { id: 'client-1', name: 'Old Name', email: 'old@b.com', stripeCustomerId: 'cus_1' },
    });
    await handleCustomerUpdated(db as never, { id: 'cus_1', name: 'New Name', email: 'new@b.com' } as never);
    expect(updateSet).toHaveBeenCalledWith({ name: 'New Name', email: 'new@b.com', updatedAt: expect.any(Date) });
    expect(updateWhere).toHaveBeenCalled();
  });

  it('keeps the existing name when Stripe reports it as null', async () => {
    const { db, updateSet } = mockDb({
      clientFindFirst: { id: 'client-1', name: 'Old Name', email: 'old@b.com', stripeCustomerId: 'cus_1' },
    });
    await handleCustomerUpdated(db as never, { id: 'cus_1', name: null, email: 'new@b.com' } as never);
    expect(updateSet).toHaveBeenCalledWith({ name: 'Old Name', email: 'new@b.com', updatedAt: expect.any(Date) });
  });

  it('is a no-op when nothing actually changed', async () => {
    const { db, update } = mockDb({
      clientFindFirst: { id: 'client-1', name: 'Old Name', email: 'old@b.com', stripeCustomerId: 'cus_1' },
    });
    await handleCustomerUpdated(db as never, { id: 'cus_1', name: 'Old Name', email: 'old@b.com' } as never);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('dispatchWebhookEvent', () => {
  const origin = 'https://instar-fit.vercel.app';

  it('routes checkout.session.completed, payment_intent.succeeded, and invoice.paid to their handlers, and no-ops on anything else', async () => {
    const { db } = mockDb({});
    (upsertClient as jest.Mock).mockResolvedValue({ id: 'client-1' });

    await expect(
      dispatchWebhookEvent(db as never, { type: 'checkout.session.completed', data: { object: { mode: 'payment', metadata: {} } } } as never, origin),
    ).resolves.toBeUndefined();
    await expect(
      dispatchWebhookEvent(db as never, { type: 'payment_intent.succeeded', data: { object: { metadata: {} } } } as never, origin),
    ).resolves.toBeUndefined();
    await expect(
      dispatchWebhookEvent(db as never, { type: 'invoice.paid', data: { object: { parent: null } } } as never, origin),
    ).resolves.toBeUndefined();
    await expect(dispatchWebhookEvent(db as never, { type: 'account.updated', data: { object: {} } } as never, origin)).resolves.toBeUndefined();
  });

  it('routes the Sprint-4 dunning and subscription-sync event types', async () => {
    const { db } = mockDb({ subscriptionFindFirst: null });

    await expect(
      dispatchWebhookEvent(db as never, { type: 'invoice.payment_failed', data: { object: { parent: null } } } as never, origin),
    ).resolves.toBeUndefined();
    await expect(
      dispatchWebhookEvent(db as never, { type: 'invoice.payment_action_required', data: { object: { parent: null } } } as never, origin),
    ).resolves.toBeUndefined();
    for (const type of [
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.paused',
      'customer.subscription.resumed',
    ] as const) {
      await expect(
        dispatchWebhookEvent(db as never, { type, data: { object: { id: 'sub_1', status: 'active', items: { data: [] } } } } as never, origin),
      ).resolves.toBeUndefined();
    }
  });

  it('routes customer.updated', async () => {
    const { db } = mockDb({ clientFindFirst: null });
    await expect(
      dispatchWebhookEvent(db as never, { type: 'customer.updated', data: { object: { id: 'cus_1', name: 'A', email: 'a@b.com' } } } as never, origin),
    ).resolves.toBeUndefined();
  });
});
