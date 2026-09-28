'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { storefrontLink } from '@/lib/storefront';
import { buildChecklist, fetchHasSale, headline, progress, type ChecklistStep } from '@/lib/sellChecklist';

/**
 * "Get ready to sell" on Today (Sprint 6 onboarding): six steps from an empty account to a first
 * sale, the next one highlighted with its button. Everything is read from what the app already
 * loaded; the only extra call is the payments list, and only once the storefront is live.
 */
export function SellChecklist() {
  const { hydrated, storefront, offers, payouts, storefrontStatus, linkShared, markLinkShared, checklistHidden, hideChecklist, toast } =
    useAppState();
  const published = !!storefrontStatus?.published;
  const [hasSale, setHasSale] = useState<boolean | null>(null);

  useEffect(() => {
    if (!published) return;
    let live = true;
    fetchHasSale().then((v) => live && setHasSale(v));
    return () => {
      live = false;
    };
  }, [published]);

  // Nothing until the first load settles, so a coach who's already set up never sees it flash in.
  if (!hydrated || !storefront || checklistHidden) return null;

  const steps = buildChecklist({
    storefrontCompleted: storefront.completed,
    activeOffers: offers.filter((o) => o.active).length,
    payouts,
    published,
    canPublish: !!storefrontStatus?.canPublish,
    linkShared,
    hasSale: published ? hasSale : null,
  });
  const { done, total, complete } = progress(steps);

  function copy() {
    if (!storefront) return;
    const path = storefrontStatus?.publicUrl ?? `/${storefront.handle}`;
    navigator.clipboard?.writeText(`${window.location.origin}${path}`).catch(() => {});
    markLinkShared();
    toast(`Copied ${storefrontLink(storefront.handle)}`);
  }

  return (
    <section className={`ins-panel ins-sc ${complete ? 'complete' : ''} ins-in d2`} aria-labelledby="sc-title">
      <div className="ins-sc-head">
        <div>
          <span className="ins-label">
            Get ready to sell · {done} of {total}
          </span>
          <h2 id="sc-title">{headline(steps)}</h2>
          {complete && <p className="ins-sc-sub">Your storefront is live and your first client has paid. You can hide this now.</p>}
        </div>
        <button type="button" className="ins-btn quiet ins-sc-hide" onClick={hideChecklist}>
          {complete ? 'Done' : 'Hide'}
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

      {!complete && (
        <ol className="ins-sc-steps">
          {steps.map((s, i) => (
            <Step key={s.key} step={s} n={i + 1} onCopy={copy} />
          ))}
        </ol>
      )}
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

function Step({ step, n, onCopy }: { step: ChecklistStep; n: number; onCopy: () => void }) {
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
      {action &&
        (action.kind === 'copy' ? (
          <button type="button" className={`ins-btn ${primary ? 'go' : 'quiet'}`} onClick={onCopy}>
            {action.label}
          </button>
        ) : (
          <Link href={action.href} className={`ins-btn ${primary ? 'go' : 'quiet'}`}>
            {action.label}
            {primary && <Icon name="arrow" />}
          </Link>
        ))}
    </li>
  );
}
