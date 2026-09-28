'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { FieldError, TextField } from '@/components/AuthFields';
import { formatMoney } from '@/lib/offers';
import { clientLabel, shortDate } from '@/lib/payoutDashboard';
import type { CoachPaymentSummary, RefundPaymentResponse, RefundQuoteResponse } from '@/lib/commerce/types';
import {
  checkQuote,
  createRefund,
  fetchRefundQuote,
  REFUND_REASONS,
  requestedAmountCents,
  toRefundRequest,
  validateRefund,
  type RefundErrors,
  type RefundForm,
  type RefundReason,
} from '@/lib/refunds';

/**
 * Refund a client payment (Sprint 5). Two steps so money never moves on one tap: choose the
 * amount and reason, then confirm against the server's quote of what the client gets back, how
 * much of Instar's fee is returned, and what comes out of the coach's balance.
 */
export function RefundDialog({
  payment,
  onClose,
  onRefunded,
}: {
  payment: CoachPaymentSummary;
  onClose: () => void;
  onRefunded: (payment: CoachPaymentSummary, refund: RefundPaymentResponse) => void;
}) {
  const { toast } = useAppState();
  const [form, setForm] = useState<RefundForm>({ mode: 'full', amountInput: '', reason: '' });
  const [errors, setErrors] = useState<RefundErrors>({});
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const [quote, setQuote] = useState<RefundQuoteResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const who = clientLabel(payment);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const set = (patch: Partial<RefundForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };

  async function review(e: FormEvent) {
    e.preventDefault();
    const next = validateRefund(form);
    const cents = requestedAmountCents(form, payment);
    setErrors(next);
    if (Object.keys(next).length > 0 || cents == null) return;
    setBusy(true);
    const result = await fetchRefundQuote(payment.id, cents);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      if (!Object.keys(result.fieldErrors).length) toast(result.message);
      return;
    }
    const problems = checkQuote(form, cents, result.quote);
    if (Object.keys(problems).length) {
      setErrors(problems);
      return;
    }
    setQuote(result.quote);
    setStep('confirm');
  }

  async function confirm() {
    if (!quote) return;
    setBusy(true);
    const result = await createRefund(payment.id, toRefundRequest(form, quote));
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      toast(result.message);
      if (Object.keys(result.fieldErrors).length) setStep('choose');
      return;
    }
    onRefunded(payment, result.refund);
  }

  return (
    <div className="ins-checkout-overlay" role="dialog" aria-modal="true" aria-labelledby="refund-title" onClick={() => !busy && onClose()}>
      <div className="ins-panel ins-checkout-box ins-refund-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ins-checkout-close" onClick={onClose} disabled={busy} aria-label="Close">
          <Icon name="close" />
        </button>

        <span className="ins-label">{step === 'choose' ? 'Refund' : 'Confirm refund'}</span>
        <h2 id="refund-title">Refund {who}</h2>
        <p className="ins-refund-sub">
          {payment.offerName} · paid {formatMoney(payment.totalAmountCents)} on {shortDate(payment.createdAt)}
          {payment.refundedAmountCents > 0 && <> · {formatMoney(payment.refundedAmountCents)} already refunded</>}
        </p>

        {step === 'choose' ? (
          <form onSubmit={review} noValidate className="ins-auth-form">
            <fieldset className="ins-sf-fieldset">
              <legend className="ins-field-l">How much</legend>
              <div className="ins-sf-seg ins-refund-seg" role="radiogroup" aria-label="How much">
                {(['full', 'partial'] as const).map((m) => (
                  <label key={m} className={`ins-sf-seg-it ${form.mode === m ? 'on' : ''}`}>
                    <input type="radio" name="mode" value={m} checked={form.mode === m} onChange={() => set({ mode: m })} />
                    {m === 'full' ? (payment.refundedAmountCents > 0 ? 'Everything left' : 'Full refund') : 'Part of it'}
                  </label>
                ))}
              </div>
            </fieldset>

            {form.mode === 'partial' ? (
              <TextField
                name="amount"
                label="Amount to refund"
                icon="payouts"
                inputMode="decimal"
                autoComplete="off"
                placeholder="50"
                value={form.amountInput}
                onChange={(e) => set({ amountInput: e.target.value })}
                error={errors.amount}
                autoFocus
              />
            ) : (
              <FieldError id="amount-err" message={errors.amount} />
            )}

            <label className="ins-field">
              <span className="ins-field-l">Reason</span>
              <span className={`ins-input ins-select ${errors.reason ? 'bad' : ''}`}>
                <Icon name="checkins" />
                <select
                  name="reason"
                  value={form.reason}
                  onChange={(e) => set({ reason: e.target.value as RefundReason })}
                  aria-invalid={!!errors.reason}
                  aria-describedby={errors.reason ? 'reason-err' : undefined}
                >
                  <option value="" disabled>
                    Choose a reason
                  </option>
                  {(Object.keys(REFUND_REASONS) as RefundReason[]).map((r) => (
                    <option key={r} value={r}>
                      {REFUND_REASONS[r]}
                    </option>
                  ))}
                </select>
              </span>
              <FieldError id="reason-err" message={errors.reason} />
            </label>

            <button type="submit" className="ins-btn go ins-auth-submit" disabled={busy}>
              {busy ? 'Checking…' : 'Review refund'}
              {!busy && <Icon name="arrow" />}
            </button>
          </form>
        ) : (
          quote && (
            <div className="ins-auth-form">
              <div className="ins-checkout-breakdown ins-num" aria-live="polite">
                <div className="ins-checkout-row">
                  <span>{who} gets back</span>
                  <span>{formatMoney(quote.clientReceivesCents)}</span>
                </div>
                <div className="ins-checkout-row muted">
                  <span>Instar’s fee, returned</span>
                  <span>{formatMoney(quote.platformFeeReversedCents)}</span>
                </div>
                <div className="ins-checkout-row total">
                  <span>Comes out of your balance</span>
                  <span>{formatMoney(quote.coachBalanceImpactCents)}</span>
                </div>
              </div>
              <p className="ins-refund-sub">
                Reason: {REFUND_REASONS[form.reason as RefundReason]}. It usually takes 5–10 business days to reach their card.
                This can’t be undone.
              </p>
              <div className="ins-actions">
                <button type="button" className="ins-btn ins-btn-bad ins-refund-go" onClick={confirm} disabled={busy} aria-busy={busy}>
                  {busy ? 'Refunding…' : `Refund ${formatMoney(quote.clientReceivesCents)}`}
                </button>
                <button type="button" className="ins-btn quiet" onClick={() => setStep('choose')} disabled={busy}>
                  Back
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
