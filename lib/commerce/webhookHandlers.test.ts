import {
  dispatchWebhookEvent,
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handlePaymentIntentSucceeded,
} from './webhookHandlers';
import { upsertClient } from './clients';
import { getStripe } from '@/lib/stripe/client';

jest.mock('./clients');
jest.mock('@/lib/stripe/client');

function mockDb(opts: {
  subscriptionFindFirst?: unknown;
  priceFindFirst?: unknown;
  clientFindFirst?: unknown;
  insertReturning?: unknown[];
}) {
  const subFindFirst = jest.fn().mockResolvedValue(opts.subscriptionFindFirst ?? null);
  const priceFindFirst = jest.fn().mockResolvedValue(opts.priceFindFirst ?? null);
  const clientFindFirst = jest.fn().mockResolvedValue(opts.clientFindFirst ?? null);

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
    },
    insert,
    update,
  };
  return { db, insert, insertValues, update, updateSet };
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

describe('dispatchWebhookEvent', () => {
  it('routes checkout.session.completed, payment_intent.succeeded, and invoice.paid to their handlers, and no-ops on anything else', async () => {
    const { db } = mockDb({});
    (upsertClient as jest.Mock).mockResolvedValue({ id: 'client-1' });

    await expect(
      dispatchWebhookEvent(db as never, { type: 'checkout.session.completed', data: { object: { mode: 'payment', metadata: {} } } } as never),
    ).resolves.toBeUndefined();
    await expect(
      dispatchWebhookEvent(db as never, { type: 'payment_intent.succeeded', data: { object: { metadata: {} } } } as never),
    ).resolves.toBeUndefined();
    await expect(
      dispatchWebhookEvent(db as never, { type: 'invoice.paid', data: { object: { parent: null } } } as never),
    ).resolves.toBeUndefined();
    await expect(dispatchWebhookEvent(db as never, { type: 'account.updated', data: { object: {} } } as never)).resolves.toBeUndefined();
  });
});
