import { computeRefundPreview, mapRefundStatus, validateRefundAmount } from './refunds';

describe('mapRefundStatus', () => {
  it('maps requires_action -> pending and canceled -> failed', () => {
    expect(mapRefundStatus('requires_action')).toBe('pending');
    expect(mapRefundStatus('canceled')).toBe('failed');
  });

  it('passes through known statuses verbatim', () => {
    expect(mapRefundStatus('pending')).toBe('pending');
    expect(mapRefundStatus('succeeded')).toBe('succeeded');
    expect(mapRefundStatus('failed')).toBe('failed');
  });

  it('falls back to pending for null/unrecognized input', () => {
    expect(mapRefundStatus(null)).toBe('pending');
    expect(mapRefundStatus(undefined)).toBe('pending');
    expect(mapRefundStatus('something_new')).toBe('pending');
  });
});

const PAYMENT = { totalAmountCents: 20000, platformFeeCents: 400, currency: 'usd' };

describe('computeRefundPreview', () => {
  it('reverses the full platform fee and full transfer on a full refund', () => {
    const result = computeRefundPreview(PAYMENT, 20000, 0);
    expect(result).toEqual({
      currency: 'usd',
      maxRefundableCents: 20000,
      clientReceivesCents: 20000,
      platformFeeReversedCents: 400,
      coachBalanceImpactCents: 19600,
    });
  });

  it('reverses the fee and transfer proportionally on a partial refund', () => {
    // Half the charge -> half the fee and half the transfer.
    const result = computeRefundPreview(PAYMENT, 10000, 0);
    expect(result).toEqual({
      currency: 'usd',
      maxRefundableCents: 20000,
      clientReceivesCents: 10000,
      platformFeeReversedCents: 200,
      coachBalanceImpactCents: 9800,
    });
  });

  it('treats a second refund that reaches the full total as a full refund, not a rounded partial', () => {
    // Already refunded 15000 of 20000; requesting the remaining 5000 should reverse the fee/transfer
    // exactly, not a fraction that might round oddly.
    const result = computeRefundPreview(PAYMENT, 5000, 15000);
    expect(result.clientReceivesCents).toBe(5000);
    expect(result.platformFeeReversedCents).toBe(400);
    expect(result.coachBalanceImpactCents).toBe(19600);
  });

  it('caps the requested amount at what is left to refund', () => {
    const result = computeRefundPreview(PAYMENT, 99999, 15000);
    expect(result.maxRefundableCents).toBe(5000);
    expect(result.clientReceivesCents).toBe(5000);
  });

  it('never goes negative when already refunded exceeds the total (defensive)', () => {
    const result = computeRefundPreview(PAYMENT, 5000, 20000);
    expect(result.maxRefundableCents).toBe(0);
    expect(result.clientReceivesCents).toBe(0);
  });
});

describe('validateRefundAmount', () => {
  it('accepts a valid positive integer within the refundable cap', () => {
    expect(validateRefundAmount(5000, 20000)).toEqual({ value: 5000 });
  });

  it('rejects zero, negative, non-integer, or non-number input', () => {
    expect('errors' in validateRefundAmount(0, 20000)!).toBe(true);
    expect('errors' in validateRefundAmount(-100, 20000)!).toBe(true);
    expect('errors' in validateRefundAmount(50.5, 20000)!).toBe(true);
    expect('errors' in validateRefundAmount('5000', 20000)!).toBe(true);
  });

  it('rejects an amount larger than what is left to refund', () => {
    const result = validateRefundAmount(20001, 20000);
    expect('errors' in result && result.errors.amountCents).toBeTruthy();
  });
});
