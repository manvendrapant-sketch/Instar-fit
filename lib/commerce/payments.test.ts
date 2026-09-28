import { toCoachPaymentSummary } from './payments';

const PAYMENT = {
  id: 'pay-1',
  currency: 'usd',
  totalAmountCents: 19900,
  status: 'succeeded' as const,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

describe('toCoachPaymentSummary', () => {
  it('builds the coach-facing payment summary shape', () => {
    expect(toCoachPaymentSummary(PAYMENT as never, 'Monthly Coaching', 'a@b.com', 'Ada', 5000)).toEqual({
      id: 'pay-1',
      clientName: 'Ada',
      clientEmail: 'a@b.com',
      offerName: 'Monthly Coaching',
      currency: 'usd',
      totalAmountCents: 19900,
      refundedAmountCents: 5000,
      status: 'succeeded',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('defaults refundedAmountCents to whatever is passed (0 for no refunds)', () => {
    expect(toCoachPaymentSummary(PAYMENT as never, 'Monthly Coaching', 'a@b.com', null, 0).refundedAmountCents).toBe(0);
  });
});
