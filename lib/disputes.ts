import { apiFetch, type ApiResult } from './api-client';
import type {
  CoachDisputeDetailResponse,
  CoachDisputeSummary,
  CoachDisputesResponse,
  DisputeEvidenceFields,
  SaveDisputeEvidenceRequest,
  UploadEvidenceFileResponse,
} from './commerce/types';

// Disputes inbox (Sprint 5). A client's bank has pulled a payment back and the coach has a few
// days to show it was legitimate. Everything shown comes from GET /api/coach/disputes(/[id]);
// the evidence itself lives on Stripe (its dispute object *is* the draft, see Decisions.md), so
// "Save draft" and "Submit" both go straight through to it.

export const DISPUTES_PATH = '/business/disputes';
export const disputePath = (id: string) => `${DISPUTES_PATH}/${encodeURIComponent(id)}`;

// ---- Status --------------------------------------------------------------------------------

export type DisputeGroup = 'respond' | 'review' | 'closed';

/** Stripe's own dispute statuses, verbatim from the API (`CoachDisputeSummary.status`). */
const STATUS: Record<string, { label: string; chip: string; group: DisputeGroup }> = {
  needs_response: { label: 'Needs response', chip: 'k-money', group: 'respond' },
  warning_needs_response: { label: 'Inquiry', chip: 'k-money', group: 'respond' },
  under_review: { label: 'With the bank', chip: 'k-checkin', group: 'review' },
  warning_under_review: { label: 'With the bank', chip: 'k-checkin', group: 'review' },
  won: { label: 'Won', chip: 'k-lead', group: 'closed' },
  lost: { label: 'Lost', chip: 'k-renew', group: 'closed' },
  warning_closed: { label: 'Closed', chip: 'k-renew', group: 'closed' },
  prevented: { label: 'Resolved', chip: 'k-lead', group: 'closed' },
  charge_refunded: { label: 'Refunded', chip: 'k-renew', group: 'closed' },
};

export function disputeStatus(status: string): { label: string; chip: string; group: DisputeGroup } {
  return STATUS[status] ?? { label: status.replace(/_/g, ' '), chip: 'k-renew', group: 'review' };
}

/** True while the coach can still add or submit evidence. */
export function canRespond(d: Pick<CoachDisputeSummary, 'status'>): boolean {
  return disputeStatus(d.status).group === 'respond';
}

// ---- Reasons -------------------------------------------------------------------------------

export interface ReasonCopy {
  /** Short label, e.g. "Says they didn't get it". */
  label: string;
  /** What the client told their bank, in plain words. */
  claim: string;
  /** What tends to win this kind of dispute. */
  helps: string;
}

const REASONS: Record<string, ReasonCopy> = {
  fraudulent: {
    label: 'Says they didn’t make the payment',
    claim: 'The cardholder told their bank they didn’t authorize this payment.',
    helps: 'Show it was really them: their name and email, and messages or sessions where they took part in the coaching.',
  },
  unrecognized: {
    label: 'Doesn’t recognize the charge',
    claim: 'The cardholder doesn’t recognize this payment on their statement.',
    helps: 'Remind the bank who you are: what they bought, when, and messages showing they know you.',
  },
  product_not_received: {
    label: 'Says they didn’t get it',
    claim: 'The client says they paid but didn’t receive the coaching.',
    helps: 'Show you delivered: when the coaching happened, session logs or program access, and your messages with them.',
  },
  not_received: {
    label: 'Says they didn’t get it',
    claim: 'The client says they paid but didn’t receive the coaching.',
    helps: 'Show you delivered: when the coaching happened, session logs or program access, and your messages with them.',
  },
  product_unacceptable: {
    label: 'Unhappy with what they got',
    claim: 'The client says the coaching wasn’t as described.',
    helps: 'Show what you promised matched what you delivered, and how your refund policy was shown before they paid.',
  },
  subscription_canceled: {
    label: 'Says they canceled',
    claim: 'The client says they canceled their subscription but were still charged.',
    helps: 'Show your cancellation policy and why this charge was still due, e.g. they never canceled, or kept using the coaching.',
  },
  credit_not_processed: {
    label: 'Says a refund never arrived',
    claim: 'The client says they were promised a refund that never came.',
    helps: 'Show your refund policy and why no refund was owed, or that you already refunded them.',
  },
  duplicate: {
    label: 'Says they were charged twice',
    claim: 'The client says this payment is a duplicate of another one.',
    helps: 'Explain why both payments were separate purchases, e.g. two different offers or two billing periods.',
  },
};

const GENERAL_REASON: ReasonCopy = {
  label: 'Payment disputed',
  claim: 'The client’s bank has disputed this payment.',
  helps: 'Describe what they bought and when, and add any messages or documents that show the payment was legitimate.',
};

export function reasonCopy(reason: string): ReasonCopy {
  return REASONS[reason] ?? GENERAL_REASON;
}

// ---- Deadline ------------------------------------------------------------------------------

export type Urgency = 'ok' | 'soon' | 'overdue' | 'none';
const DAY = 86_400_000;

/**
 * Countdown to the evidence deadline. "soon" is 3 days or less, the point where a coach who
 * hasn't started should drop everything. Not money: just dates, so it's fine in the browser.
 */
export function deadline(
  evidenceDueBy: string | null,
  now: Date = new Date(),
): { label: string; urgency: Urgency; daysLeft: number | null } {
  if (!evidenceDueBy) return { label: 'No deadline set', urgency: 'none', daysLeft: null };
  const ms = new Date(evidenceDueBy).getTime() - now.getTime();
  if (ms <= 0) return { label: 'Past due', urgency: 'overdue', daysLeft: 0 };
  const daysLeft = Math.ceil(ms / DAY);
  if (ms < DAY) {
    const hours = Math.max(1, Math.ceil(ms / 3_600_000));
    return { label: `${hours} hour${hours === 1 ? '' : 's'} left`, urgency: 'soon', daysLeft };
  }
  return { label: `${daysLeft} days left`, urgency: daysLeft <= 3 ? 'soon' : 'ok', daysLeft };
}

/** "Due Oct 4, 11:59 PM" in the coach's own time zone. */
export function dueLabel(evidenceDueBy: string | null): string {
  if (!evidenceDueBy) return '';
  const d = new Date(evidenceDueBy);
  return `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Splits the inbox into its three sections, the ones needing a response soonest-due first. */
export function groupDisputes(list: CoachDisputeSummary[]): Record<DisputeGroup, CoachDisputeSummary[]> {
  const groups: Record<DisputeGroup, CoachDisputeSummary[]> = { respond: [], review: [], closed: [] };
  for (const d of list) groups[disputeStatus(d.status).group].push(d);
  const due = (d: CoachDisputeSummary) => (d.evidenceDueBy ? new Date(d.evidenceDueBy).getTime() : Infinity);
  groups.respond.sort((a, b) => due(a) - due(b));
  return groups;
}

// ---- Evidence form --------------------------------------------------------------------------

export type EvidenceKey = keyof DisputeEvidenceFields;
export type EvidenceKind = 'text' | 'longtext' | 'file';

export const EVIDENCE_FIELDS: Record<EvidenceKey, { label: string; hint?: string; placeholder?: string; kind: EvidenceKind }> = {
  productDescription: {
    label: 'What they bought',
    kind: 'longtext',
    hint: 'What was included, how you delivered it, and over what dates.',
    placeholder: 'e.g. 12 weeks of 1:1 strength coaching: weekly video calls, a custom program in the app, daily check-ins.',
  },
  serviceDate: { label: 'When you coached them', kind: 'text', placeholder: 'e.g. Aug 4 – Oct 27, 2026' },
  customerName: { label: 'Client’s name', kind: 'text' },
  customerEmailAddress: { label: 'Client’s email', kind: 'text' },
  customerPurchaseIp: { label: 'IP address they bought from', kind: 'text', hint: 'Only if you have it. Leave blank otherwise.' },
  billingAddress: { label: 'Billing address', kind: 'longtext' },
  cancellationPolicyDisclosure: {
    label: 'How you showed your cancellation policy',
    kind: 'longtext',
    hint: 'Where they saw it before paying, e.g. your storefront or welcome email.',
  },
  cancellationRebuttal: {
    label: 'Why this charge was still due',
    kind: 'longtext',
    placeholder: 'e.g. They never asked to cancel, and joined two calls after the date they say they canceled.',
  },
  refundPolicyDisclosure: {
    label: 'How you showed your refund policy',
    kind: 'longtext',
    hint: 'Where they saw it before paying, e.g. your storefront or welcome email.',
  },
  refundRefusalExplanation: { label: 'Why no refund was owed', kind: 'longtext' },
  uncategorizedText: { label: 'Anything else the bank should know', kind: 'longtext' },
  customerCommunication: {
    label: 'Messages with the client',
    kind: 'file',
    hint: 'Emails, DMs or check-in chats showing they took part. One PDF, JPG or PNG.',
  },
  serviceDocumentation: {
    label: 'Proof you delivered',
    kind: 'file',
    hint: 'Session logs, a signed agreement or program screenshots. One PDF, JPG or PNG.',
  },
  uncategorizedFile: { label: 'Other file', kind: 'file', hint: 'One PDF, JPG or PNG.' },
};

/** Stripe's own limit on a single text field. */
export const TEXT_MAX = 20_000;
/** Stripe takes PDF, JPEG and PNG as dispute evidence. Card networks cap a dispute's files at
 * about 4.5 MB in total, so each one is held to that to be safe. */
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const FILE_MAX_BYTES = 4.5 * 1024 * 1024;

export type EvidenceForm = Record<EvidenceKey, string>;
export type EvidenceErrors = Partial<Record<EvidenceKey | 'form', string>>;

/**
 * The form's starting values: whatever's already staged on Stripe, with the client's name and
 * email filled in from the dispute when nothing's staged yet, since those are always the same.
 */
export function initialForm(d: CoachDisputeDetailResponse): EvidenceForm {
  const form = {} as EvidenceForm;
  for (const key of Object.keys(EVIDENCE_FIELDS) as EvidenceKey[]) form[key] = d.evidence[key] ?? '';
  if (!form.customerName && d.clientName) form.customerName = d.clientName;
  if (!form.customerEmailAddress) form.customerEmailAddress = d.clientEmail;
  return form;
}

/** Only the fields this dispute asks for, in the order shown. */
export function visibleFields(d: Pick<CoachDisputeDetailResponse, 'acceptedEvidenceFields'>): EvidenceKey[] {
  const order = Object.keys(EVIDENCE_FIELDS) as EvidenceKey[];
  return order.filter((k) => d.acceptedEvidenceFields.includes(k));
}

/**
 * What to send: visible fields that differ from what Stripe already holds. A cleared field is
 * sent as "" so Stripe clears it too; untouched ones are left out so a save never overwrites them.
 */
export function changedFields(form: EvidenceForm, saved: DisputeEvidenceFields, fields: EvidenceKey[]): SaveDisputeEvidenceRequest {
  const out: SaveDisputeEvidenceRequest = {};
  for (const key of fields) {
    const value = EVIDENCE_FIELDS[key].kind === 'file' ? form[key] : form[key].trim();
    if (value !== (saved[key] ?? '')) out[key] = value;
  }
  return out;
}

export function validateEvidence(form: EvidenceForm, fields: EvidenceKey[], forSubmit: boolean): EvidenceErrors {
  const errors: EvidenceErrors = {};
  for (const key of fields) {
    if (EVIDENCE_FIELDS[key].kind !== 'file' && form[key].length > TEXT_MAX) {
      errors[key] = `Keep this under ${TEXT_MAX.toLocaleString('en-US')} characters.`;
    }
  }
  if (forSubmit) {
    const described = fields.some((k) => EVIDENCE_FIELDS[k].kind === 'longtext' && form[k].trim());
    if (!described) errors.form = 'Explain your side in at least one of the boxes before you submit.';
  }
  return errors;
}

/** Checked before uploading so a coach isn't left waiting on an upload Stripe will reject. */
export function validateFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!FILE_TYPES.includes(file.type)) return 'Use a PDF, JPG or PNG.';
  if (file.size > FILE_MAX_BYTES) return 'That file is over 4.5 MB. Try a smaller export or a screenshot.';
  return null;
}

// ---- Calls ----------------------------------------------------------------------------------

export type ListResult = { ok: true; disputes: CoachDisputeSummary[] } | { ok: false; message: string };
export type DetailResult = { ok: true; dispute: CoachDisputeDetailResponse } | { ok: false; message: string; notFound: boolean };

export async function fetchDisputes(): Promise<ListResult> {
  const res = await apiFetch<CoachDisputesResponse>('/api/coach/disputes');
  return res.success ? { ok: true, disputes: res.data.disputes } : { ok: false, message: res.message };
}

export async function fetchDispute(id: string): Promise<DetailResult> {
  const res = await apiFetch<CoachDisputeDetailResponse>(`/api/coach/disputes/${encodeURIComponent(id)}`);
  return res.success ? { ok: true, dispute: res.data } : { ok: false, message: res.message, notFound: res.code === 'NOT_FOUND' };
}

/** PATCH saves a draft; POST submits it to the bank. Both return the dispute as Stripe now holds it. */
export async function saveEvidence(id: string, fields: SaveDisputeEvidenceRequest, submit: boolean): Promise<DetailResult> {
  const res = await apiFetch<CoachDisputeDetailResponse>(`/api/coach/disputes/${encodeURIComponent(id)}/evidence`, {
    method: submit ? 'POST' : 'PATCH',
    body: fields,
  });
  return res.success ? { ok: true, dispute: res.data } : { ok: false, message: res.message, notFound: res.code === 'NOT_FOUND' };
}

/** Multipart, so it can't go through apiFetch's JSON body; same never-throws contract. */
export async function uploadEvidenceFile(
  id: string,
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; fileId: string } | { ok: false; message: string }> {
  try {
    const body = new FormData();
    body.append('file', file);
    const res = await fetchImpl(`/api/coach/disputes/${encodeURIComponent(id)}/files`, { method: 'POST', body });
    const json = (await res.json()) as ApiResult<UploadEvidenceFileResponse>;
    if (json.success) return { ok: true, fileId: json.data.fileId };
    return { ok: false, message: json.fields?.file ?? json.message };
  } catch {
    return { ok: false, message: 'The upload didn’t go through. Please try again.' };
  }
}
