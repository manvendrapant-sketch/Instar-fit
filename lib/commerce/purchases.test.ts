import { toClientPurchaseSummary, toCoachPurchaseSummary } from './purchases';

const PAYMENT = {
  id: 'pay-1',
  currency: 'usd',
  totalAmountCents: 49900,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

describe('toClientPurchaseSummary', () => {
  it('builds the client-facing purchase shape', () => {
    expect(toClientPurchaseSummary(PAYMENT as never, '12-Week Program')).toEqual({
      id: 'pay-1',
      offerName: '12-Week Program',
      currency: 'usd',
      amountCents: 49900,
      purchasedAt: '2026-09-01T00:00:00.000Z',
    });
  });
});

describe('toCoachPurchaseSummary', () => {
  it('builds the coach-facing purchase shape', () => {
    expect(toCoachPurchaseSummary(PAYMENT as never, '12-Week Program', 'client-1', 'a@b.com', 'Ada')).toEqual({
      id: 'pay-1',
      clientId: 'client-1',
      clientEmail: 'a@b.com',
      clientName: 'Ada',
      offerName: '12-Week Program',
      currency: 'usd',
      amountCents: 49900,
      purchasedAt: '2026-09-01T00:00:00.000Z',
    });
  });
});
