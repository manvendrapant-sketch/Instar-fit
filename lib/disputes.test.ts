import type { CoachDisputeDetailResponse, CoachDisputeSummary, DisputeEvidenceFields } from './commerce/types';
import {
  canRespond,
  changedFields,
  deadline,
  disputePath,
  disputeStatus,
  EVIDENCE_FIELDS,
  fetchDispute,
  fetchDisputes,
  FILE_MAX_BYTES,
  groupDisputes,
  initialForm,
  reasonCopy,
  saveEvidence,
  TEXT_MAX,
  uploadEvidenceFile,
  validateEvidence,
  validateFile,
  visibleFields,
} from './disputes';

const NOW = new Date('2026-09-28T12:00:00.000Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

const emptyEvidence: DisputeEvidenceFields = {
  customerName: null,
  customerEmailAddress: null,
  customerPurchaseIp: null,
  productDescription: null,
  billingAddress: null,
  refundPolicyDisclosure: null,
  refundRefusalExplanation: null,
  cancellationPolicyDisclosure: null,
  cancellationRebuttal: null,
  serviceDate: null,
  uncategorizedText: null,
  customerCommunication: null,
  serviceDocumentation: null,
  uncategorizedFile: null,
};

const summary = (over: Partial<CoachDisputeSummary> = {}): CoachDisputeSummary => ({
  id: 'dp_1',
  paymentId: 'pay_1',
  clientName: 'Leah Kim',
  clientEmail: 'leah@example.com',
  offerName: '1:1 Coaching',
  currency: 'usd',
  amountCents: 20_497,
  reason: 'product_not_received',
  status: 'needs_response',
  evidenceDueBy: inDays(5),
  createdAt: inDays(-2),
  ...over,
});

const detail = (over: Partial<CoachDisputeDetailResponse> = {}): CoachDisputeDetailResponse => ({
  ...summary(),
  evidence: emptyEvidence,
  acceptedEvidenceFields: ['productDescription', 'customerCommunication', 'serviceDate', 'serviceDocumentation'],
  submissionCount: 0,
  pastDue: false,
  ...over,
});

describe('disputeStatus / canRespond', () => {
  it('maps Stripe statuses into respond / review / closed', () => {
    expect(disputeStatus('needs_response').group).toBe('respond');
    expect(disputeStatus('warning_needs_response').group).toBe('respond');
    expect(disputeStatus('under_review').group).toBe('review');
    expect(disputeStatus('won')).toMatchObject({ label: 'Won', group: 'closed' });
    expect(disputeStatus('lost').group).toBe('closed');
  });
  it('falls back to a readable label for a status it doesn’t know', () => {
    expect(disputeStatus('some_new_status')).toMatchObject({ label: 'some new status', group: 'review' });
  });
  it('only lets the coach respond while Stripe is waiting on them', () => {
    expect(canRespond({ status: 'needs_response' })).toBe(true);
    expect(canRespond({ status: 'under_review' })).toBe(false);
    expect(canRespond({ status: 'won' })).toBe(false);
  });
});

describe('reasonCopy', () => {
  it('explains known reasons and falls back for the rest', () => {
    expect(reasonCopy('subscription_canceled').label).toBe('Says they canceled');
    expect(reasonCopy('general').label).toBe('Payment disputed');
    expect(reasonCopy('bank_cannot_process').claim).toMatch(/disputed this payment/);
  });
});

describe('deadline', () => {
  it('counts days, and flags 3 days or fewer as soon', () => {
    expect(deadline(inDays(5), NOW)).toEqual({ label: '5 days left', urgency: 'ok', daysLeft: 5 });
    expect(deadline(inDays(3), NOW)).toMatchObject({ label: '3 days left', urgency: 'soon' });
    expect(deadline(inDays(2.2), NOW)).toMatchObject({ label: '3 days left', urgency: 'soon' });
  });
  it('switches to hours on the last day', () => {
    expect(deadline(inDays(0.25), NOW)).toMatchObject({ label: '6 hours left', urgency: 'soon' });
    expect(deadline(new Date(NOW.getTime() + 60_000).toISOString(), NOW).label).toBe('1 hour left');
  });
  it('handles past due and a missing date', () => {
    expect(deadline(inDays(-1), NOW)).toMatchObject({ label: 'Past due', urgency: 'overdue' });
    expect(deadline(null, NOW)).toMatchObject({ urgency: 'none', daysLeft: null });
  });
});

describe('groupDisputes', () => {
  it('splits by status and puts the soonest deadline first', () => {
    const g = groupDisputes([
      summary({ id: 'late', evidenceDueBy: inDays(9) }),
      summary({ id: 'won', status: 'won' }),
      summary({ id: 'soon', evidenceDueBy: inDays(1) }),
      summary({ id: 'nodate', evidenceDueBy: null }),
      summary({ id: 'bank', status: 'under_review' }),
    ]);
    expect(g.respond.map((d) => d.id)).toEqual(['soon', 'late', 'nodate']);
    expect(g.review.map((d) => d.id)).toEqual(['bank']);
    expect(g.closed.map((d) => d.id)).toEqual(['won']);
  });
});

describe('evidence form', () => {
  it('starts from what Stripe holds, with the client’s name and email filled in', () => {
    const f = initialForm(detail({ evidence: { ...emptyEvidence, productDescription: 'Coaching' } }));
    expect(f.productDescription).toBe('Coaching');
    expect(f.customerName).toBe('Leah Kim');
    expect(f.customerEmailAddress).toBe('leah@example.com');
    expect(f.serviceDate).toBe('');
  });
  it('never overwrites a name already staged on Stripe', () => {
    expect(initialForm(detail({ evidence: { ...emptyEvidence, customerName: 'L. Kim' } })).customerName).toBe('L. Kim');
  });
  it('shows only the fields this dispute asks for, in a fixed order', () => {
    expect(visibleFields(detail())).toEqual(['productDescription', 'serviceDate', 'customerCommunication', 'serviceDocumentation']);
  });
  it('sends only visible fields that changed, trimmed, and clears with ""', () => {
    const saved = { ...emptyEvidence, serviceDate: 'Aug 4', productDescription: 'Old' };
    const form = {
      ...initialForm(detail({ evidence: saved })),
      productDescription: '  New text  ',
      serviceDate: '',
      billingAddress: 'hidden',
    };
    expect(changedFields(form, saved, visibleFields(detail()))).toEqual({ productDescription: 'New text', serviceDate: '' });
  });
  it('sends nothing when nothing changed', () => {
    const d = detail();
    expect(changedFields(initialForm(d), d.evidence, visibleFields(d))).toEqual({});
  });
  it('limits text length and needs an explanation before submitting', () => {
    const d = detail();
    const fields = visibleFields(d);
    const blank = initialForm(d);
    expect(validateEvidence(blank, fields, false)).toEqual({});
    expect(validateEvidence(blank, fields, true).form).toMatch(/at least one/);
    expect(validateEvidence({ ...blank, productDescription: 'We coached them weekly.' }, fields, true)).toEqual({});
    expect(validateEvidence({ ...blank, productDescription: 'x'.repeat(TEXT_MAX + 1) }, fields, false).productDescription).toBeDefined();
  });
  it('has a label for every evidence field in the contract', () => {
    expect(Object.keys(EVIDENCE_FIELDS).sort()).toEqual(Object.keys(emptyEvidence).sort());
  });
  it('checks file type and size before uploading', () => {
    expect(validateFile({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(validateFile({ type: 'image/png', size: FILE_MAX_BYTES })).toBeNull();
    expect(validateFile({ type: 'image/gif', size: 1000 })).toMatch(/PDF, JPG or PNG/);
    expect(validateFile({ type: 'image/jpeg', size: FILE_MAX_BYTES + 1 })).toMatch(/4.5 MB/);
  });
});

describe('calls', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  const respond = (body: unknown) => fetchMock.mockResolvedValueOnce({ json: async () => body } as Response);

  it('loads the list', async () => {
    respond({ success: true, message: 'ok', data: { disputes: [summary()] } });
    await expect(fetchDisputes()).resolves.toEqual({ ok: true, disputes: [summary()] });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/coach/disputes');
  });
  it('loads one dispute and tells not-found apart from other failures', async () => {
    respond({ success: true, message: 'ok', data: detail() });
    await expect(fetchDispute('dp/1')).resolves.toEqual({ ok: true, dispute: detail() });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/coach/disputes/dp%2F1');
    respond({ success: false, code: 'NOT_FOUND', message: 'Dispute not found.' });
    await expect(fetchDispute('x')).resolves.toMatchObject({ ok: false, notFound: true });
    respond({ success: false, code: 'INTERNAL_ERROR', message: 'Oops' });
    await expect(fetchDispute('x')).resolves.toMatchObject({ ok: false, notFound: false, message: 'Oops' });
  });
  it('saves a draft with PATCH and submits with POST', async () => {
    respond({ success: true, message: 'Draft saved.', data: detail() });
    await saveEvidence('dp_1', { productDescription: 'Hi' }, false);
    respond({ success: true, message: 'Evidence submitted.', data: detail({ submissionCount: 1 }) });
    const r = await saveEvidence('dp_1', {}, true);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ productDescription: 'Hi' }) });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/coach/disputes/dp_1/evidence');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    expect(r).toMatchObject({ ok: true, dispute: { submissionCount: 1 } });
  });
  it('uploads a file as multipart and returns its id', async () => {
    const up = jest.fn(
      async () => ({ json: async () => ({ success: true, message: 'ok', data: { fileId: 'file_1' } }) }) as unknown as Response,
    );
    const file = new File(['%PDF'], 'chat.pdf', { type: 'application/pdf' });
    await expect(uploadEvidenceFile('dp_1', file, up)).resolves.toEqual({ ok: true, fileId: 'file_1' });
    const [path, init] = up.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/coach/disputes/dp_1/files');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });
  it('reports a rejected or failed upload without throwing', async () => {
    const rejected = jest.fn(
      async () =>
        ({
          json: async () => ({ success: false, code: 'VALIDATION_ERROR', message: 'Bad', fields: { file: 'Choose a file to upload.' } }),
        }) as unknown as Response,
    );
    await expect(uploadEvidenceFile('dp_1', new File([''], 'a.pdf'), rejected)).resolves.toEqual({
      ok: false,
      message: 'Choose a file to upload.',
    });
    const offline = jest.fn(async () => {
      throw new Error('offline');
    });
    await expect(uploadEvidenceFile('dp_1', new File([''], 'a.pdf'), offline as unknown as typeof fetch)).resolves.toMatchObject({
      ok: false,
    });
  });
  it('builds encoded detail paths', () => {
    expect(disputePath('dp 1')).toBe('/business/disputes/dp%201');
  });
});
