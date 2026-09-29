'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { buildChecklist, headline, progress, type ChecklistStep } from '@/lib/sellChecklist';

/**
 * "Get ready to sell" on Today (Sprint 6 onboarding): four steps from an empty account to a live
 * storefront, the next one highlighted with its button. Closes itself the moment all four are done,
 * and stays closed on every device once the coach has closed it (server-side, on their profile).
 */
export function SellChecklist() {
  const { hydrated, storefront, offers, payouts, storefrontStatus, checklistHidden, hideChecklist } = useAppState();

  const closed = checklistHidden || !!storefront?.setupChecklistClosedAt;
  const steps =
    hydrated && storefront
      ? buildChecklist({
          storefrontCompleted: storefront.completed,
          activeOffers: offers.filter((o) => o.active).length,
          payouts,
          published: !!storefrontStatus?.published,
          canPublish: !!storefrontStatus?.canPublish,
        })
      : null;
  const complete = !!steps && progress(steps).complete;

  // All four done: close it for good. No "Done" click needed.
  useEffect(() => {
    if (complete && !closed) hideChecklist();
  }, [complete, closed, hideChecklist]);

  // Nothing until the first load settles, so a coach who's already set up never sees it flash in.
  if (!steps || closed || complete) return null;

  const { done, total } = progress(steps);

  return (
    <section className="ins-panel ins-sc ins-in d2" aria-labelledby="sc-title">
      <div className="ins-sc-head">
        <div>
          <span className="ins-label">
            Get ready to sell · {done} of {total}
          </span>
          <h2 id="sc-title">{headline(steps)}</h2>
        </div>
        <button type="button" className="ins-btn quiet ins-sc-hide" onClick={hideChecklist}>
          Hide
        </button>
      </div>

      <div
        className="ins-sc-bar"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} steps done`}
      >
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>

      <ol className="ins-sc-steps">
        {steps.map((s, i) => (
          <Step key={s.key} step={s} n={i + 1} />
        ))}
      </ol>
    </section>
  );
}

const STATE_WORD: Record<ChecklistStep['state'], string> = {
  done: 'Done',
  next: 'Next',
  todo: 'To do',
  waiting: 'Waiting',
  locked: 'Not yet',
};

function Step({ step, n }: { step: ChecklistStep; n: number }) {
  const { state, action } = step;
  const primary = state === 'next';
  return (
    <li className={`ins-sc-step ${state}`} aria-current={primary ? 'step' : undefined}>
      <span className="ins-sc-dot" aria-hidden="true">
        {state === 'done' ? <Icon name="check" className="ins-i sm" /> : state === 'locked' ? <Icon name="lock" className="ins-i sm" /> : n}
      </span>
      <div className="ins-sc-text">
        <b>
          {step.title}
          <span className="ins-sr"> ({STATE_WORD[state]})</span>
        </b>
        <span>{step.body}</span>
      </div>
      {action && (
        <Link href={action.href} className={`ins-btn ${primary ? 'go' : 'quiet'}`}>
          {action.label}
          {primary && <Icon name="arrow" />}
        </Link>
      )}
    </li>
  );
}
