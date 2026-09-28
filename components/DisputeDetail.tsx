'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { formatMoney } from '@/lib/offers';
import { FieldError } from '@/components/AuthFields';
import { LoadingSection } from '@/components/LoadingSection';
import { shortDate } from '@/lib/payoutDashboard';
import type { CoachDisputeDetailResponse } from '@/lib/commerce/types';
import {
  canRespond,
  changedFields,
  deadline,
  disputeStatus,
  DISPUTES_PATH,
  dueLabel,
  EVIDENCE_FIELDS,
  fetchDispute,
  initialForm,
  reasonCopy,
  saveEvidence,
  TEXT_MAX,
  uploadEvidenceFile,
  validateEvidence,
  validateFile,
  visibleFields,
  type EvidenceErrors,
  type EvidenceForm,
  type EvidenceKey,
} from '@/lib/disputes';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean }
  | { status: 'ready'; dispute: CoachDisputeDetailResponse };

function DetailHero({ title, sub }: { title: string; sub?: string }) {
  return (
    <section className="ins-space-hero">
      <div>
        <div className="ins-label ins-in" style={{ marginBottom: 18 }}>
          <Link href={DISPUTES_PATH} className="ins-dp-back">
            Business · Disputes
          </Link>
        </div>
        <h1 className="ins-in d1">{title}</h1>
        {sub && <p className="ins-in d2">{sub}</p>}
      </div>
    </section>
  );
}

/**
 * One dispute (Sprint 5): the deadline, what the client told their bank, and the evidence form.
 * Only the fields that matter for this dispute's reason are shown. "Save draft" stages the
 * evidence on Stripe without sending it; "Submit" sends it to the bank, once.
 */
export function DisputeDetail({ id }: { id: string }) {
  const { toast } = useAppState();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [form, setForm] = useState<EvidenceForm | null>(null);
  const [errors, setErrors] = useState<EvidenceErrors>({});
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const [uploading, setUploading] = useState<EvidenceKey | null>(null);
  const [fileNames, setFileNames] = useState<Partial<Record<EvidenceKey, string>>>({});
  const [confirming, setConfirming] = useState(false);

  const reload = useCallback(() => {
    setLoad({ status: 'loading' });
    fetchDispute(id).then((r) => {
      if (r.ok) {
        setLoad({ status: 'ready', dispute: r.dispute });
        setForm(initialForm(r.dispute));
      } else {
        setLoad({ status: 'error', message: r.message, notFound: r.notFound });
      }
    });
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, same pattern as ClientsPage
    reload();
  }, [reload]);

  const dispute = load.status === 'ready' ? load.dispute : null;
  const fields = useMemo(() => (dispute ? visibleFields(dispute) : []), [dispute]);
  const pending = dispute && form ? changedFields(form, dispute.evidence, fields) : {};
  const dirty = Object.keys(pending).length > 0;

  // Warn before leaving with evidence typed but not saved: it only exists in this tab until then.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (load.status === 'loading') {
    return (
      <>
        <DetailHero title="Dispute" />
        <LoadingSection label="Loading this dispute…" />
      </>
    );
  }

  if (load.status === 'error' || !dispute || !form) {
    const notFound = load.status === 'error' && load.notFound;
    return (
      <>
        <DetailHero title="Dispute" />
        <section className="ins-panel ins-offers-missing ins-in" aria-live="polite">
          <h2>{notFound ? 'This dispute isn’t here' : 'Couldn’t load this dispute'}</h2>
          <p>{notFound ? 'It may belong to another account.' : load.status === 'error' ? load.message : ''}</p>
          <div className="ins-actions">
            {!notFound && (
              <button type="button" className="ins-btn go" onClick={reload}>
                Try again
              </button>
            )}
            <Link href={DISPUTES_PATH} className="ins-btn quiet">
              All disputes
            </Link>
          </div>
        </section>
      </>
    );
  }

  const who = dispute.clientName?.trim() || dispute.clientEmail;
  const st = disputeStatus(dispute.status);
  const reason = reasonCopy(dispute.reason);
  const submitted = dispute.submissionCount > 0;
  const open = canRespond(dispute) && !submitted;
  const due = deadline(dispute.evidenceDueBy);
  // Stripe has the evidence but our row's status only moves on the next webhook, so say so now.
  const awaitingBank = submitted && st.group === 'respond';

  const set = (key: EvidenceKey, value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  async function onFile(key: EvidenceKey, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      setErrors((x) => ({ ...x, [key]: problem }));
      return;
    }
    setUploading(key);
    const r = await uploadEvidenceFile(id, file);
    setUploading(null);
    if (!r.ok) {
      setErrors((x) => ({ ...x, [key]: r.message }));
      return;
    }
    set(key, r.fileId);
    setFileNames((n) => ({ ...n, [key]: file.name }));
  }

  async function save(submit: boolean) {
    if (!form || !dispute) return;
    const next = validateEvidence(form, fields, submit);
    setErrors(next);
    if (Object.keys(next).length) {
      setConfirming(false);
      return;
    }
    setBusy(submit ? 'submit' : 'save');
    const r = await saveEvidence(id, changedFields(form, dispute.evidence, fields), submit);
    setBusy(null);
    setConfirming(false);
    if (!r.ok) {
      toast(r.message);
      return;
    }
    setLoad({ status: 'ready', dispute: r.dispute });
    setForm(initialForm(r.dispute));
    toast(
      submit ? 'Sent to the bank. We’ll show the outcome here when they decide.' : 'Draft saved. Nothing has been sent to the bank yet.',
    );
  }

  return (
    <>
      <DetailHero
        title={`${who} disputed a payment`}
        sub={`${dispute.offerName} · ${formatMoney(dispute.amountCents)} · opened ${shortDate(dispute.createdAt)}`}
      />

      <div className="ins-pd">
        <div className="ins-pd-top">
          <section className="ins-panel ins-money ins-pd-hero ins-in d1" aria-label={open ? 'Time left to respond' : 'Status'}>
            {open ? (
              <>
                <span className="ins-label">Time left to respond</span>
                <div className="ins-big ins-num">{due.urgency === 'overdue' ? 'Past due' : due.label.replace(' left', '')}</div>
                <div className="ins-delta">
                  <b>{dueLabel(dispute.evidenceDueBy) || 'No deadline from the bank yet'}</b>
                  {due.urgency === 'soon' && ' · don’t leave this to the last day'}
                </div>
              </>
            ) : (
              <>
                <span className="ins-label">Status</span>
                <div className="ins-big">{awaitingBank ? 'Submitted' : st.label}</div>
                <div className="ins-delta">{outcomeLine(st.group, submitted, dispute.status)}</div>
              </>
            )}
          </section>

          <section className="ins-panel ins-pd-stats ins-dp-facts ins-in d2" aria-label="Dispute details">
            <div className="ins-pd-stat">
              <span className="ins-pd-stat-l">Being held</span>
              <b className="ins-num">{formatMoney(dispute.amountCents)}</b>
              <span className="ins-pd-muted">Taken back from your balance until the bank decides</span>
            </div>
            <div className="ins-pd-stat">
              <span className="ins-pd-stat-l">Client</span>
              <b className="ins-dp-fact">{who}</b>
              <span className="ins-pd-muted">{dispute.clientEmail}</span>
            </div>
            <div className="ins-pd-stat">
              <span className="ins-pd-stat-l">Status</span>
              <span className={`ins-chip ${awaitingBank ? 'k-checkin' : st.chip}`}>{awaitingBank ? 'Submitted' : st.label}</span>
              <span className="ins-pd-muted">{reason.label}</span>
            </div>
          </section>
        </div>

        <div className="ins-pd-grid">
          <div className="ins-dp-main">
            {open ? (
              <section className="ins-panel ins-pd-card ins-in d2" aria-labelledby="dp-evidence">
                <div className="ins-pd-card-h">
                  <h2 id="dp-evidence">Your side</h2>
                  <span className="ins-label">{dirty ? 'Unsaved changes' : 'Saved'}</span>
                </div>
                <p className="ins-pd-muted ins-dp-note">
                  Write it for a bank reviewer who’s never heard of you: plain facts, dates, and proof. You can save a draft and come back.
                </p>

                <form className="ins-auth-form ins-dp-form" noValidate onSubmit={(e) => e.preventDefault()}>
                  {fields.map((key) => (
                    <EvidenceField
                      key={key}
                      name={key}
                      value={form[key]}
                      error={errors[key]}
                      fileName={fileNames[key]}
                      uploading={uploading === key}
                      disabled={!!busy}
                      onChange={(v) => set(key, v)}
                      onFile={(e) => onFile(key, e)}
                    />
                  ))}

                  <FieldError id="dp-form-err" message={errors.form} />

                  {confirming ? (
                    <div className="ins-dp-confirm" role="alertdialog" aria-labelledby="dp-confirm-t">
                      <p id="dp-confirm-t">
                        <b>Send this to the bank?</b> You can only submit once, and you can’t change it afterwards.
                      </p>
                      <div className="ins-actions">
                        <button
                          type="button"
                          className="ins-btn go"
                          onClick={() => save(true)}
                          disabled={!!busy}
                          aria-busy={busy === 'submit'}
                        >
                          {busy === 'submit' ? 'Sending…' : 'Yes, submit'}
                        </button>
                        <button type="button" className="ins-btn quiet" onClick={() => setConfirming(false)} disabled={!!busy}>
                          Not yet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ins-actions">
                      <button type="button" className="ins-btn go" onClick={() => setConfirming(true)} disabled={!!busy || !!uploading}>
                        Submit to the bank
                        <Icon name="arrow" />
                      </button>
                      <button
                        type="button"
                        className="ins-btn"
                        onClick={() => save(false)}
                        disabled={!!busy || !!uploading || !dirty}
                        aria-busy={busy === 'save'}
                      >
                        {busy === 'save' ? 'Saving…' : 'Save draft'}
                      </button>
                    </div>
                  )}
                </form>
              </section>
            ) : (
              <SubmittedEvidence dispute={dispute} fields={fields} submitted={submitted} />
            )}
          </div>

          <aside className="ins-pd-side">
            <section className="ins-panel ins-pd-card ins-dp-reason ins-in d3" aria-labelledby="dp-reason">
              <h2 id="dp-reason">What the bank was told</h2>
              <p>{reason.claim}</p>
              <h3 className="ins-label">What helps</h3>
              <p>{reason.helps}</p>
            </section>
            <section className="ins-panel ins-pd-card ins-dp-reason ins-in d4" aria-labelledby="dp-how">
              <h2 id="dp-how">How this works</h2>
              <ol className="ins-dp-steps">
                <li>The bank takes the payment back while it looks into it.</li>
                <li>You send your side before the deadline. If you don’t, the bank sides with the client.</li>
                <li>The bank decides, usually within 60–75 days. If you win, the money comes back to you.</li>
              </ol>
              {open && <p className="ins-pd-muted">Think the client’s right? You can let the deadline pass instead of responding.</p>}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function outcomeLine(group: string, submitted: boolean, status: string): string {
  if (status === 'won') return 'The bank sided with you. The money is back in your balance.';
  if (status === 'lost') return 'The bank sided with the client. The money went back to them.';
  if (group === 'closed') return 'This dispute is closed.';
  if (submitted || group === 'review') return 'Your side is with the bank. Banks usually decide within 60–75 days.';
  return 'The deadline to respond has passed.';
}

function EvidenceField({
  name,
  value,
  error,
  fileName,
  uploading,
  disabled,
  onChange,
  onFile,
}: {
  name: EvidenceKey;
  value: string;
  error?: string;
  fileName?: string;
  uploading: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const meta = EVIDENCE_FIELDS[name];
  const errId = `${name}-err`;
  const hintId = `${name}-hint`;
  const describedBy = [meta.hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;

  if (meta.kind === 'file') {
    return (
      <div className="ins-field">
        <span className="ins-field-l" id={`${name}-l`}>
          {meta.label} <span className="ins-sf-opt">Optional</span>
        </span>
        {value ? (
          <div className="ins-dp-file">
            <Icon name="file" className="ins-i sm" />
            <span>{fileName ?? 'File attached'}</span>
            <button
              type="button"
              className="ins-btn quiet"
              onClick={() => onChange('')}
              disabled={disabled}
              aria-label={`Remove ${meta.label}`}
            >
              Remove
            </button>
          </div>
        ) : (
          <label className={`ins-btn ins-dp-upload ${uploading || disabled ? 'is-disabled' : ''}`} aria-describedby={describedBy}>
            <Icon name="upload" />
            {uploading ? 'Uploading…' : 'Choose a file'}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={onFile}
              disabled={uploading || disabled}
              aria-labelledby={`${name}-l`}
            />
          </label>
        )}
        {meta.hint && (
          <span className="ins-field-hint" id={hintId}>
            {meta.hint}
          </span>
        )}
        <FieldError id={errId} message={error} />
      </div>
    );
  }

  return (
    <label className="ins-field">
      <span className="ins-field-l">{meta.label}</span>
      {meta.kind === 'longtext' ? (
        <span className={`ins-textarea ${error ? 'bad' : ''}`}>
          <textarea
            name={name}
            rows={4}
            maxLength={TEXT_MAX}
            placeholder={meta.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        </span>
      ) : (
        <span className={`ins-input ${error ? 'bad' : ''}`}>
          <input
            name={name}
            type={name === 'customerEmailAddress' ? 'email' : 'text'}
            placeholder={meta.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        </span>
      )}
      {meta.hint && (
        <span className="ins-field-hint" id={hintId}>
          {meta.hint}
        </span>
      )}
      <FieldError id={errId} message={error} />
    </label>
  );
}

function SubmittedEvidence({
  dispute,
  fields,
  submitted,
}: {
  dispute: CoachDisputeDetailResponse;
  fields: EvidenceKey[];
  submitted: boolean;
}) {
  const filled = fields.filter((k) => dispute.evidence[k]);
  return (
    <section className="ins-panel ins-pd-card ins-in d2" aria-labelledby="dp-sent">
      <h2 id="dp-sent">{submitted ? 'What you sent' : 'Evidence'}</h2>
      {filled.length === 0 ? (
        <p className="ins-pd-none">{submitted ? 'Nothing was attached to this response.' : 'No evidence was sent for this dispute.'}</p>
      ) : (
        <dl className="ins-dp-sent">
          {filled.map((k) => (
            <div key={k}>
              <dt>{EVIDENCE_FIELDS[k].label}</dt>
              <dd>{EVIDENCE_FIELDS[k].kind === 'file' ? 'File attached' : dispute.evidence[k]}</dd>
            </div>
          ))}
        </dl>
      )}
      {dispute.pastDue && <p className="ins-pd-muted">This was sent after the deadline, so the bank may not consider it.</p>}
    </section>
  );
}
