'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/lib/icons';
import { formatMoney } from '@/lib/offers';
import { LoadingSection } from '@/components/LoadingSection';
import type { CoachDisputeSummary } from '@/lib/commerce/types';
import { deadline, disputePath, disputeStatus, dueLabel, fetchDisputes, groupDisputes, reasonCopy } from '@/lib/disputes';
import { shortDate } from '@/lib/payoutDashboard';

function DisputesHero() {
  return (
    <section className="ins-space-hero">
      <div>
        <div className="ins-label ins-in" style={{ marginBottom: 18 }}>
          Business · Disputes
        </div>
        <h1 className="ins-in d1">Disputes</h1>
        <p className="ins-in d2">When a client asks their bank to reverse a payment, you get a few days to show your side. Respond here.</p>
      </div>
    </section>
  );
}

/** The disputes inbox (Sprint 5): what needs a response, what's with the bank, what's closed. */
export function DisputesPage() {
  const [state, setState] = useState<{ ok: true; disputes: CoachDisputeSummary[] } | { ok: false; message: string } | null>(null);

  const load = useCallback(() => {
    setState(null);
    fetchDisputes().then(setState);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, same pattern as ClientsPage
    load();
  }, [load]);

  if (!state) {
    return (
      <>
        <DisputesHero />
        <LoadingSection label="Loading your disputes…" />
      </>
    );
  }

  if (!state.ok) {
    return (
      <>
        <DisputesHero />
        <section className="ins-panel ins-offers-missing ins-in" aria-live="polite">
          <h2>Couldn’t load your disputes</h2>
          <p>{state.message}</p>
          <button type="button" className="ins-btn go" onClick={load}>
            Try again
          </button>
        </section>
      </>
    );
  }

  if (state.disputes.length === 0) {
    return (
      <>
        <DisputesHero />
        <section className="ins-panel ins-offers-empty ins-in d2" aria-labelledby="dp-empty">
          <span className="ins-sf-prompt-icon lg" aria-hidden="true">
            <Icon name="check" />
          </span>
          <h2 id="dp-empty">No disputes</h2>
          <p>If a client ever disputes a payment with their bank, it shows up here with a deadline, and on your Today page too.</p>
        </section>
      </>
    );
  }

  const groups = groupDisputes(state.disputes);

  return (
    <>
      <DisputesHero />
      <div className="ins-dp-sections">
        <DisputeSection title="Needs your response" empty="Nothing waiting on you." list={groups.respond} showDeadline delay="d1" />
        {groups.review.length > 0 && (
          <DisputeSection
            title="With the bank"
            note="You’ve sent your side. Banks usually decide within 60–75 days."
            list={groups.review}
            delay="d2"
          />
        )}
        {groups.closed.length > 0 && <DisputeSection title="Closed" list={groups.closed} delay="d3" />}
      </div>
    </>
  );
}

function DisputeSection({
  title,
  note,
  empty,
  list,
  showDeadline = false,
  delay,
}: {
  title: string;
  note?: string;
  empty?: string;
  list: CoachDisputeSummary[];
  showDeadline?: boolean;
  delay: string;
}) {
  return (
    <section className={`ins-panel ins-pd-card ins-in ${delay}`} aria-labelledby={`dp-${delay}`}>
      <div className="ins-pd-card-h">
        <h2 id={`dp-${delay}`}>{title}</h2>
        <span className="ins-label">{list.length}</span>
      </div>
      {note && <p className="ins-pd-muted ins-dp-note">{note}</p>}
      {list.length === 0 ? (
        <p className="ins-pd-none">{empty}</p>
      ) : (
        <ul className="ins-pd-list">
          {list.map((d) => (
            <DisputeRow key={d.id} d={d} showDeadline={showDeadline} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DisputeRow({ d, showDeadline }: { d: CoachDisputeSummary; showDeadline: boolean }) {
  const st = disputeStatus(d.status);
  const due = deadline(d.evidenceDueBy);
  const who = d.clientName?.trim() || d.clientEmail;
  return (
    <li>
      <Link href={disputePath(d.id)} className="ins-pd-row ins-dp-row" aria-label={`Dispute from ${who}, ${formatMoney(d.amountCents)}`}>
        <div className="ins-pd-who">
          <b>{who}</b>
          <span>
            {reasonCopy(d.reason).label} · {d.offerName} · opened {shortDate(d.createdAt)}
          </span>
        </div>
        <b className="ins-num ins-dp-amt">{formatMoney(d.amountCents)}</b>
        {showDeadline ? (
          <span className={`ins-dp-due ${due.urgency}`} title={dueLabel(d.evidenceDueBy)}>
            {due.label}
          </span>
        ) : (
          <span className={`ins-chip ${st.chip}`}>{st.label}</span>
        )}
        <Icon name="chev" className="ins-i sm" />
      </Link>
    </li>
  );
}
