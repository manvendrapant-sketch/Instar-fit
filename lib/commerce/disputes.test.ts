import { acceptedEvidenceFieldsForReason, findOwnDispute, toCoachDisputeSummary, toEvidenceFields, toEvidenceParams } from './disputes';

describe('toEvidenceFields', () => {
  it('maps Stripe evidence to our camelCase shape, resolving file ids from plain strings', () => {
    const result = toEvidenceFields({
      customer_name: 'Ada',
      customer_email_address: 'ada@example.com',
      customer_purchase_ip: '1.2.3.4',
      product_description: 'A coaching program',
      billing_address: null,
      refund_policy_disclosure: null,
      refund_refusal_explanation: null,
      cancellation_policy_disclosure: null,
      cancellation_rebuttal: null,
      service_date: '2026-09-01',
      uncategorized_text: null,
      customer_communication: 'file_123',
      service_documentation: null,
      uncategorized_file: null,
    } as never);

    expect(result).toEqual({
      customerName: 'Ada',
      customerEmailAddress: 'ada@example.com',
      customerPurchaseIp: '1.2.3.4',
      productDescription: 'A coaching program',
      billingAddress: null,
      refundPolicyDisclosure: null,
      refundRefusalExplanation: null,
      cancellationPolicyDisclosure: null,
      cancellationRebuttal: null,
      serviceDate: '2026-09-01',
      uncategorizedText: null,
      customerCommunication: 'file_123',
      serviceDocumentation: null,
      uncategorizedFile: null,
    });
  });

  it('resolves an expanded File object down to its id', () => {
    const result = toEvidenceFields({ customer_communication: { id: 'file_456' } } as never);
    expect(result.customerCommunication).toBe('file_456');
  });

  it('defaults everything to null when evidence is undefined', () => {
    const result = toEvidenceFields(undefined);
    expect(result.customerName).toBeNull();
    expect(result.customerCommunication).toBeNull();
  });
});

describe('toEvidenceParams', () => {
  it('only includes keys actually present, mapped to snake_case', () => {
    expect(toEvidenceParams({ customerName: 'Ada', serviceDate: '2026-09-01' })).toEqual({
      customer_name: 'Ada',
      service_date: '2026-09-01',
    });
  });

  it('omits null/undefined values rather than sending them through', () => {
    expect(toEvidenceParams({ customerName: null, productDescription: 'A program' })).toEqual({
      product_description: 'A program',
    });
  });

  it('returns an empty object for an empty input', () => {
    expect(toEvidenceParams({})).toEqual({});
  });
});

describe('acceptedEvidenceFieldsForReason', () => {
  it('returns a curated field list for a known reason', () => {
    expect(acceptedEvidenceFieldsForReason('fraudulent')).toContain('customerPurchaseIp');
  });

  it('falls back to the general field set for an unmapped reason', () => {
    const fields = acceptedEvidenceFieldsForReason('duplicate');
    expect(fields).toEqual(['productDescription', 'customerCommunication', 'uncategorizedText', 'uncategorizedFile']);
  });
});

describe('toCoachDisputeSummary', () => {
  it('builds the coach-facing dispute summary shape', () => {
    const row = {
      id: 'dis-1',
      paymentId: 'pay-1',
      amountCents: 19900,
      reason: 'fraudulent',
      status: 'needs_response',
      evidenceDueBy: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-09-20T00:00:00.000Z'),
    };
    expect(toCoachDisputeSummary(row as never, 'usd', 'a@b.com', 'Ada', 'Monthly Coaching')).toEqual({
      id: 'dis-1',
      paymentId: 'pay-1',
      clientName: 'Ada',
      clientEmail: 'a@b.com',
      offerName: 'Monthly Coaching',
      currency: 'usd',
      amountCents: 19900,
      reason: 'fraudulent',
      status: 'needs_response',
      evidenceDueBy: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-09-20T00:00:00.000Z',
    });
  });

  it('defaults a null reason to "general"', () => {
    const row = { id: 'dis-1', paymentId: 'pay-1', amountCents: 100, reason: null, status: 'won', evidenceDueBy: null, createdAt: new Date() };
    expect(toCoachDisputeSummary(row as never, 'usd', 'a@b.com', null, 'Offer').reason).toBe('general');
  });
});

describe('findOwnDispute', () => {
  it('scopes the lookup to both the dispute id and the coach id', async () => {
    const limit = jest.fn().mockResolvedValue([{ dispute: { id: 'dis-1' }, payment: {}, client: {}, offer: null }]);
    const where = jest.fn().mockReturnValue({ limit });
    const leftJoin = jest.fn().mockReturnValue({ where });
    const innerJoin2 = jest.fn().mockReturnValue({ leftJoin });
    const innerJoin1 = jest.fn().mockReturnValue({ innerJoin: innerJoin2 });
    const from = jest.fn().mockReturnValue({ innerJoin: innerJoin1 });
    const db = { select: jest.fn().mockReturnValue({ from }) };

    const result = await findOwnDispute(db as never, 'coach-1', 'dis-1');
    expect(result).toEqual({ dispute: { id: 'dis-1' }, payment: {}, client: {}, offer: null });
  });

  it('returns null when nothing matches', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ limit });
    const leftJoin = jest.fn().mockReturnValue({ where });
    const innerJoin2 = jest.fn().mockReturnValue({ leftJoin });
    const innerJoin1 = jest.fn().mockReturnValue({ innerJoin: innerJoin2 });
    const from = jest.fn().mockReturnValue({ innerJoin: innerJoin1 });
    const db = { select: jest.fn().mockReturnValue({ from }) };

    expect(await findOwnDispute(db as never, 'coach-1', 'dis-1')).toBeNull();
  });
});
