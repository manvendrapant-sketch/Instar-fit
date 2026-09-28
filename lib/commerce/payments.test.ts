import { sumNetEarnedCents, toCoachPaymentSummary } from './payments';

const PAYMENT = {
  id: 'pay-1',
  currency: 'usd',
  totalAmountCents: 19900,
  platformFeeCents: 398,
  status: 'succeeded' as const,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
};

describe('toCoachPaymentSummary', () => {
  it('builds the coach-facing payment summary shape, netting out the platform fee and refunds', () => {
    expect(toCoachPaymentSummary(PAYMENT as never, 'Monthly Coaching', 'a@b.com', 'Ada', 5000)).toEqual({
      id: 'pay-1',
      clientName: 'Ada',
      clientEmail: 'a@b.com',
      offerName: 'Monthly Coaching',
      currency: 'usd',
      totalAmountCents: 19900,
      netCents: 19900 - 398 - 5000,
      refundedAmountCents: 5000,
      status: 'succeeded',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('defaults refundedAmountCents to whatever is passed (0 for no refunds)', () => {
    const result = toCoachPaymentSummary(PAYMENT as never, 'Monthly Coaching', 'a@b.com', null, 0);
    expect(result.refundedAmountCents).toBe(0);
    expect(result.netCents).toBe(19900 - 398);
  });

  it('never returns a negative netCents even if refunds somehow exceed what was earned', () => {
    expect(toCoachPaymentSummary(PAYMENT as never, 'Monthly Coaching', 'a@b.com', null, 999999).netCents).toBe(0);
  });
});

function mockDb(paymentRows: unknown[], refundRows: unknown[] = []) {
  return {
    query: { payments: { findMany: jest.fn().mockResolvedValue(paymentRows) } },
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(refundRows) }),
    }),
  };
}

describe('sumNetEarnedCents', () => {
  it('sums totalAmountCents minus platformFeeCents across matching payments', async () => {
    const db = mockDb([
      { id: 'p1', totalAmountCents: 10000, platformFeeCents: 200 },
      { id: 'p2', totalAmountCents: 5000, platformFeeCents: 100 },
    ]);
    const result = await sumNetEarnedCents(db as never, 'coach-1', new Date('2026-09-01'), new Date('2026-10-01'));
    expect(result).toBe(10000 - 200 + (5000 - 100));
  });

  it('subtracts succeeded refunds for the matching payment only', async () => {
    const db = mockDb(
      [
        { id: 'p1', totalAmountCents: 10000, platformFeeCents: 200 },
        { id: 'p2', totalAmountCents: 5000, platformFeeCents: 100 },
      ],
      [{ paymentId: 'p1', amountCents: 3000 }],
    );
    const result = await sumNetEarnedCents(db as never, 'coach-1', new Date('2026-09-01'), new Date('2026-10-01'));
    expect(result).toBe(10000 - 200 - 3000 + (5000 - 100));
  });

  it('returns 0 and skips the refunds query when there are no matching payments', async () => {
    const db = mockDb([]);
    const result = await sumNetEarnedCents(db as never, 'coach-1', new Date('2026-09-01'), new Date('2026-10-01'));
    expect(result).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('never lets a single payment go negative even with refunds larger than its net', async () => {
    const db = mockDb([{ id: 'p1', totalAmountCents: 1000, platformFeeCents: 20 }], [{ paymentId: 'p1', amountCents: 5000 }]);
    const result = await sumNetEarnedCents(db as never, 'coach-1', new Date('2026-09-01'), new Date('2026-10-01'));
    expect(result).toBe(0);
  });
});
