'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/lib/icons';
import { clientLogout } from '@/lib/clientAuth';
import {
  cancelSubscriptionApi,
  fetchClientSubscriptions,
  formatSubscriptionPrice,
  openBillingPortal,
  pauseSubscriptionApi,
  PAUSE_REASON_LABEL,
  resumeSubscriptionApi,
  type PauseFieldErrors,
} from '@/lib/clientSubscriptions';
import type { ClientSubscriptionSummary, PauseReason } from '@/lib/commerce/types';
import { useAppState } from '@/lib/store';
import { LoadingSection } from '@/components/LoadingSection';

const STATUS_LABEL: Record<ClientSubscriptionSummary['status'], string> = {
  incomplete: 'Incomplete',
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  paused: 'Paused',
  canceled: 'Canceled',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** yyyy-mm-dd for tomorrow, in the visitor's local time zone — the date input's min. */
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function PauseForm({
  subscriptionId,
  onDone,
  onCancel,
}: {
  subscriptionId: string;
  onDone: (updated: ClientSubscriptionSummary) => void;
  onCancel: () => void;
}) {
  const { toast } = useAppState();
  const [reason, setReason] = useState<PauseReason>('vacation');
  const [resumeDate, setResumeDate] = useState('');
  const [errors, setErrors] = useState<PauseFieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    if (!resumeDate) {
      setErrors({ resumeDate: 'Pick a date to resume billing.' });
      return;
    }
    setErrors({});
    setPending(true);
    const result = await pauseSubscriptionApi(subscriptionId, { reason, resumeDate });
    setPending(false);
    if (result.ok) {
      onDone(result.subscription);
      return;
    }
    if (result.fieldErrors) setErrors(result.fieldErrors);
    else toast(result.message);
  }

  return (
    <div className="ins-client-pause-form" role="group" aria-label="Pause subscription">
      <label className="ins-field">
        <span className="ins-field-l">Reason</span>
        <span className="ins-input">
          <select value={reason} onChange={(e) => setReason(e.target.value as PauseReason)} disabled={pending}>
            {(Object.keys(PAUSE_REASON_LABEL) as PauseReason[]).map((r) => (
              <option key={r} value={r}>
                {PAUSE_REASON_LABEL[r]}
              </option>
            ))}
          </select>
          <Icon name="chev" className="ins-i ins-select-chev" />
        </span>
      </label>
      <label className="ins-field">
        <span className="ins-field-l">Resume on</span>
        <span className={`ins-input ${errors.resumeDate ? 'bad' : ''}`}>
          <input
            type="date"
            min={tomorrow()}
            value={resumeDate}
            onChange={(e) => setResumeDate(e.target.value)}
            disabled={pending}
            aria-invalid={!!errors.resumeDate}
          />
        </span>
        {errors.resumeDate && (
          <span className="ins-field-err" role="alert">
            {errors.resumeDate}
          </span>
        )}
      </label>
      <div className="ins-actions">
        <button type="button" className="ins-btn go" onClick={onSubmit} disabled={pending} aria-busy={pending}>
          {pending ? 'Pausing…' : 'Confirm pause'}
        </button>
        <button type="button" className="ins-btn quiet" onClick={onCancel} disabled={pending}>
          Never mind
        </button>
      </div>
    </div>
  );
}

function SubscriptionCard({
  subscription,
  onUpdated,
}: {
  subscription: ClientSubscriptionSummary;
  onUpdated: (updated: ClientSubscriptionSummary) => void;
}) {
  const { toast } = useAppState();
  const [pausing, setPausing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, setPending] = useState(false);
  const [portalPending, setPortalPending] = useState(false);

  async function onUpdateCard() {
    setPortalPending(true);
    const result = await openBillingPortal();
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    setPortalPending(false);
    toast(result.message);
  }

  async function onResume() {
    setPending(true);
    const result = await resumeSubscriptionApi(subscription.id);
    setPending(false);
    if (result.ok) onUpdated(result.subscription);
    else toast(result.message);
  }

  async function onCancel() {
    setPending(true);
    const result = await cancelSubscriptionApi(subscription.id);
    setPending(false);
    if (result.ok) {
      onUpdated({ ...subscription, status: 'canceled', pauseResumesAt: null, pauseReason: null });
      toast('Subscription canceled.');
    } else {
      toast(result.message);
    }
  }

  const canManage = subscription.status !== 'canceled';

  return (
    <section className={`ins-panel ins-client-sub-card ${subscription.status}`} aria-label={subscription.offerName}>
      {subscription.status === 'past_due' && (
        <div className="ins-client-banner bad">
          Your last payment didn&rsquo;t go through. Update your card to keep this active.
        </div>
      )}

      <div className="ins-client-sub-head">
        <div>
          <h3>{subscription.offerName}</h3>
          <span className="ins-num">{formatSubscriptionPrice(subscription)}</span>
        </div>
        <span className={`ins-chip k-${subscription.status === 'active' ? 'lead' : subscription.status === 'past_due' ? 'renew' : 'quiet'}`}>
          {STATUS_LABEL[subscription.status]}
        </span>
      </div>

      {subscription.status === 'paused' ? (
        <p className="ins-field-hint">Paused · billing resumes {formatDate(subscription.pauseResumesAt)}</p>
      ) : subscription.status === 'canceled' ? (
        <p className="ins-field-hint">This subscription has been canceled.</p>
      ) : (
        <p className="ins-field-hint">Next charge {formatDate(subscription.currentPeriodEnd)}</p>
      )}

      {canManage && (
        <div className="ins-actions">
          <button type="button" className="ins-btn" onClick={onUpdateCard} disabled={portalPending}>
            {portalPending ? 'Redirecting…' : 'Update card'}
          </button>

          {subscription.status === 'paused' ? (
            <button type="button" className="ins-btn quiet" onClick={onResume} disabled={pending} aria-busy={pending}>
              {pending ? 'Resuming…' : 'Resume now'}
            </button>
          ) : (
            !pausing && (
              <button type="button" className="ins-btn quiet" onClick={() => setPausing(true)}>
                Pause
              </button>
            )
          )}

          {!confirmCancel ? (
            <button type="button" className="ins-btn quiet" onClick={() => setConfirmCancel(true)}>
              Cancel
            </button>
          ) : (
            <span className="ins-offer-confirm" role="group" aria-label="Confirm cancel">
              <span>Cancel for good?</span>
              <button type="button" className="ins-btn ins-btn-bad" onClick={onCancel} disabled={pending}>
                {pending ? 'Canceling…' : 'Yes, cancel'}
              </button>
              <button type="button" className="ins-btn quiet" onClick={() => setConfirmCancel(false)} disabled={pending}>
                Never mind
              </button>
            </span>
          )}
        </div>
      )}

      {pausing && (
        <PauseForm
          subscriptionId={subscription.id}
          onDone={(updated) => {
            setPausing(false);
            onUpdated(updated);
          }}
          onCancel={() => setPausing(false)}
        />
      )}
    </section>
  );
}

/**
 * The client's "My subscription" page: plan, next charge, update card, pause (shown before
 * cancel, per the workplan), cancel, and a failed-payment banner. Subscriptions load from
 * GET /api/client/subscriptions rather than the coach dashboard's AppStateProvider, which never
 * fetches client-scoped data.
 */
export function ClientAccountView({
  email,
  name,
  coachDisplayName,
}: {
  email: string;
  name: string | null;
  coachDisplayName: string;
}) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [subscriptions, setSubscriptions] = useState<ClientSubscriptionSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    fetchClientSubscriptions().then((result) => {
      if (result.ok) setSubscriptions(result.subscriptions);
      else setLoadError(result.message);
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, same pattern as StorefrontCreator/ClientsPage
    load();
  }, [load]);

  function onUpdated(updated: ClientSubscriptionSummary) {
    setSubscriptions((prev) => (prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : prev));
  }

  async function onLogout() {
    setLoggingOut(true);
    await clientLogout();
    window.location.href = window.location.pathname.replace(/\/account$/, '/account/login');
  }

  return (
    <>
      <section className="ins-panel ins-auth-card ins-in" aria-labelledby="client-account-title">
        <div className="ins-auth-card-h">
          <h2 id="client-account-title">{name ? `Hi, ${name.split(' ')[0]}` : "You're logged in"}</h2>
          <p>
            {email} · working with {coachDisplayName}
          </p>
        </div>
        <button type="button" className="ins-btn ins-auth-submit" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? 'Logging out…' : 'Log out'}
          <Icon name="logout" />
        </button>
      </section>

      {subscriptions === null && !loadError && <LoadingSection label="Loading your subscription…" />}

      {loadError && (
        <section className="ins-panel ins-offers-missing ins-in" aria-live="polite">
          <h2>Couldn&rsquo;t load your subscription</h2>
          <p>Something went wrong. Check your connection and try again.</p>
          <button type="button" className="ins-btn go" onClick={load}>
            Try again
          </button>
        </section>
      )}

      {subscriptions !== null && subscriptions.length === 0 && (
        <section className="ins-panel ins-offers-missing ins-in">
          <h2>No subscription yet</h2>
          <p>You don&rsquo;t have an active subscription with {coachDisplayName}.</p>
        </section>
      )}

      {subscriptions !== null &&
        subscriptions.map((s) => <SubscriptionCard key={s.id} subscription={s} onUpdated={onUpdated} />)}
    </>
  );
}
