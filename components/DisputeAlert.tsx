'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/lib/icons';
import { formatMoney } from '@/lib/offers';
import type { CoachDisputeSummary } from '@/lib/commerce/types';
import { deadline, disputePath, DISPUTES_PATH, fetchDisputes, groupDisputes } from '@/lib/disputes';

/**
 * The "alert" half of the disputes inbox (Sprint 5): a banner on Today and Payouts whenever a
 * dispute is waiting on the coach. Silent when there's nothing to do or the list didn't load,
 * since a failed alert shouldn't block the page it sits on; the inbox itself shows real errors.
 */
export function DisputeAlert() {
  const [open, setOpen] = useState<CoachDisputeSummary[] | null>(null);

  useEffect(() => {
    let live = true;
    fetchDisputes().then((r) => {
      if (live && r.ok) setOpen(groupDisputes(r.disputes).respond);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!open || open.length === 0) return null;

  const first = open[0];
  const due = deadline(first.evidenceDueBy);
  const many = open.length > 1;
  const who = first.clientName?.trim() || first.clientEmail;

  return (
    <section className={`ins-panel ins-dp-alert ${due.urgency} ins-in`} role="alert" aria-labelledby="dp-alert-title">
      <span className="ins-dp-alert-icon" aria-hidden="true">
        <Icon name="alert" />
      </span>
      <div className="ins-dp-alert-body">
        <h2 id="dp-alert-title">
          {many ? `${open.length} disputes need your response` : `${who} disputed a ${formatMoney(first.amountCents)} payment`}
        </h2>
        <p>
          {due.urgency === 'overdue' ? (
            <>
              {many ? 'The soonest is ' : 'The deadline to send your side is '}
              <b>past due</b>.
            </>
          ) : (
            <>
              {many ? 'The soonest has ' : 'Their bank is holding the money, and you have '}
              <b>{due.label}</b>
              {many ? '.' : ' to send your side.'}
            </>
          )}{' '}
          If you don’t respond, the bank sides with the client.
        </p>
      </div>
      <Link href={many ? DISPUTES_PATH : disputePath(first.id)} className="ins-btn go">
        {many ? 'Open disputes' : 'Respond'}
        <Icon name="arrow" />
      </Link>
    </section>
  );
}
