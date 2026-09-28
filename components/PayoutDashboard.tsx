'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { formatMoney } from '@/lib/offers';
import { LoadingSection } from '@/components/LoadingSection';
import { STOREFRONT_PATH } from '@/lib/storefront';
import { createDashboardLink } from '@/lib/payouts';
import type { CoachPaymentSummary, CoachPayoutSummary } from '@/lib/commerce/types';
import {
  arrivalLabel,
  clientLabel,
  delayLabel,
  fetchPayoutDashboard,
  isEmptyDashboard,
  PAYMENT_STATUS,
  PAYOUT_STATUS,
  scheduleLabel,
  shortDate,
  type DashboardResult,
  type PayoutDashboardData,
} from '@/lib/payoutDashboard';

/**
 * The money side of Payouts once Connect is ready (Sprint 5): what's coming, what's arrived,
 * and every client payment. Every figure comes from the server; this only formats it.
 */
export function PayoutDashboard() {
  const { toast } = useAppState();
  const [state, setState] = useState<DashboardResult | null>(null);
  const [managing, setManaging] = useState(false);

  const load = useCallback(() => {
    setState(null);
    fetchPayoutDashboard().then(setState);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, same pattern as ClientsPage
    load();
  }, [load]);

  if (!state) return <LoadingSection label="Loading your money…" />;

  if (!state.ok) {
    return (
      <section className="ins-panel ins-offers-missing ins-in" aria-live="polite">
        <h2>Couldn’t load your payouts</h2>
        <p>{state.message} Your money is safe with Stripe; this is only the view.</p>
        <button type="button" className="ins-btn go" onClick={load}>
          Try again
        </button>
      </section>
    );
  }

  const d = state.data;
  const manage = async () => {
    if (managing) return;
    setManaging(true);
    const result = await createDashboardLink();
    if (result.ok) {
      window.location.href = result.url;
      return;
    }
    setManaging(false);
    toast(result.message);
  };

  return (
    <div className="ins-pd">
      {isEmptyDashboard(d) ? (
        <EmptyDashboard />
      ) : (
        <>
          <div className="ins-pd-top">
            <NextPayoutCard d={d} />
            <section className="ins-panel ins-pd-stats ins-in d2" aria-label="Balance">
              <Stat label="Earned this month" cents={d.balance.earnedThisMonthCents} note={`Last month ${formatMoney(d.balance.earnedLastMonthCents)}`} />
              <Stat label="On its way" cents={d.balance.pendingCents} note="Paid by clients, not available yet" />
              <Stat label="Available" cents={d.balance.availableCents} note="Goes out with your next payout" />
            </section>
          </div>

          <div className="ins-pd-grid">
            <PaymentsPanel payments={d.payments} />
            <div className="ins-pd-side">
              <PayoutsPanel payouts={d.payouts} />
              <section className="ins-panel ins-pd-card ins-in d3" aria-labelledby="pd-sched">
                <h2 id="pd-sched">Payout schedule</h2>
                <p className="ins-pd-sched">{scheduleLabel(d.schedule)}</p>
                <p className="ins-pd-muted">{delayLabel(d.schedule)}</p>
                <button type="button" className="ins-btn" onClick={manage} disabled={managing}>
                  {managing ? 'Opening…' : 'Change on Stripe'}
                </button>
              </section>
            </div>
          </div>
        </>
      )}

      <section className="ins-pd-account ins-in d4" aria-label="Payout account">
        <span>
          <span className="ins-po-live" aria-hidden="true" /> Accepting payments
        </span>
        <span>
          <span className="ins-po-live" aria-hidden="true" /> Payouts to your bank
        </span>
        <span>
          <Icon name="lock" className="ins-i sm" /> Bank account managed on Stripe
        </span>
        <button type="button" className="ins-btn quiet" onClick={manage} disabled={managing}>
          {managing ? 'Opening…' : 'Manage on Stripe'}
        </button>
      </section>
    </div>
  );
}

function NextPayoutCard({ d }: { d: PayoutDashboardData }) {
  const next = d.nextPayout;
  return (
    <section className="ins-panel ins-money ins-pd-hero ins-in d1" aria-label={next ? 'Next payout' : 'Available'}>
      <span className="ins-label">{next ? 'Next payout' : 'Available to pay out'}</span>
      <div className="ins-big ins-num">{formatMoney(next ? next.amountCents : d.balance.availableCents)}</div>
      <div className="ins-delta">
        {next ? (
          <>
            <b>{arrivalLabel(next.arrivalDate)}</b> · lands in your bank {shortDate(next.arrivalDate)}
          </>
        ) : (
          <>{scheduleLabel(d.schedule)} payouts · nothing scheduled yet</>
        )}
      </div>
    </section>
  );
}

function Stat({ label, cents, note }: { label: string; cents: number; note: string }) {
  return (
    <div className="ins-pd-stat">
      <span className="ins-pd-stat-l">{label}</span>
      <b className="ins-num">{formatMoney(cents)}</b>
      <span className="ins-pd-muted">{note}</span>
    </div>
  );
}

function PaymentsPanel({ payments }: { payments: CoachPaymentSummary[] }) {
  return (
    <section className="ins-panel ins-pd-card ins-in d2" aria-labelledby="pd-payments">
      <div className="ins-pd-card-h">
        <h2 id="pd-payments">Recent payments</h2>
        <span className="ins-label">Client paid · you get</span>
      </div>
      {payments.length === 0 ? (
        <p className="ins-pd-none">No client payments yet. They show here the moment someone buys.</p>
      ) : (
        <ul className="ins-pd-list">
          {payments.map((p) => {
            const st = PAYMENT_STATUS[p.status];
            return (
              <li key={p.id} className="ins-pd-row">
                <div className="ins-pd-who">
                  <b>{clientLabel(p)}</b>
                  <span>
                    {p.offerName} · {shortDate(p.createdAt)}
                  </span>
                </div>
                <div className="ins-pd-amt">
                  <span className="ins-num">{formatMoney(p.totalAmountCents)}</span>
                  <b className="ins-num">{formatMoney(p.netCents)}</b>
                  {p.refundedAmountCents > 0 && <span className="ins-pd-muted ins-num">−{formatMoney(p.refundedAmountCents)} refunded</span>}
                </div>
                <span className={`ins-chip ${st.chip}`}>{st.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PayoutsPanel({ payouts }: { payouts: CoachPayoutSummary[] }) {
  return (
    <section className="ins-panel ins-pd-card ins-in d3" aria-labelledby="pd-payouts">
      <h2 id="pd-payouts">Payouts to your bank</h2>
      {payouts.length === 0 ? (
        <p className="ins-pd-none">Your first payout is sent automatically once client money becomes available.</p>
      ) : (
        <ul className="ins-pd-list">
          {payouts.map((p) => {
            const st = PAYOUT_STATUS[p.status];
            return (
              <li key={p.id} className="ins-pd-row compact">
                <div className="ins-pd-who">
                  <b className="ins-num">{formatMoney(p.amountCents)}</b>
                  <span>{p.status === 'paid' ? `Arrived ${shortDate(p.arrivalDate)}` : `Arrives ${shortDate(p.arrivalDate)}`}</span>
                </div>
                <span className={`ins-chip ${st.chip}`}>{st.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyDashboard() {
  return (
    <section className="ins-panel ins-offers-empty ins-in d2" aria-labelledby="pd-empty">
      <span className="ins-sf-prompt-icon lg" aria-hidden="true">
        <Icon name="payouts" />
      </span>
      <h2 id="pd-empty">No money in yet</h2>
      <p>When a client pays, you’ll see it here, then watch it move to your bank. Share your storefront link to get your first sale.</p>
      <Link href={STOREFRONT_PATH} className="ins-btn go">
        Go to your storefront
        <Icon name="arrow" />
      </Link>
    </section>
  );
}
