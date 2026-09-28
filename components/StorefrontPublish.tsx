'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { OFFERS_PATH } from '@/lib/offers';
import { canPublish, publishSteps } from '@/lib/publicStorefront';
import { setStorefrontPublished, storefrontLink } from '@/lib/storefront';

/**
 * The storefront page's status card once a storefront exists: what's left before it can go
 * public, the Publish button (locked until payouts are ready, per the workplan), and the
 * "you're live" state with the link to share.
 */
export function StorefrontPublish({ onEdit }: { onEdit: () => void }) {
  const { storefront, offers, payouts, storefrontStatus, refreshStorefrontStatus, toast, markLinkShared } = useAppState();
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!storefront) return null;

  const steps = publishSteps({ storefront, offers, payouts });
  // The server (GET /api/storefront) decides; the steps only explain why it's locked.
  const ready = canPublish(storefrontStatus);
  const blockers = steps.filter((s) => !s.done);
  const published = !!storefrontStatus?.published;
  const link = storefrontLink(storefront.handle);
  const pagePath = storefrontStatus?.publicUrl ?? `/${storefront.handle}`;

  async function toggle(next: boolean) {
    setBusy(true);
    const result = await setStorefrontPublished(next);
    if (result.ok) await refreshStorefrontStatus();
    setBusy(false);
    if (!result.ok) {
      toast(result.message);
      return false;
    }
    return true;
  }

  function copy() {
    const url = `${window.location.origin}${pagePath}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    markLinkShared();
    toast(`Copied ${link}`);
  }

  async function publish() {
    if (!ready || busy) return;
    if (await toggle(true)) {
      toast('You’re live');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (published) {
    return (
      <section className="ins-panel ins-sf-done ins-in d2" aria-labelledby="pub-title" aria-live="polite">
        <span className="ins-chip k-lead">
          <span className="ins-po-live" aria-hidden="true" />
          &nbsp;Live
        </span>
        <h2 id="pub-title">
          You’re live at <span className="ins-num">{link}</span>
        </h2>
        <p>Put this link in your Instagram bio. Clients can see your page, pick an offer and pay you.</p>

        <div className="ins-pub-link">
          <Icon name="lock" className="ins-i sm" />
          <span className="ins-num">{link}</span>
          <button type="button" className="ins-btn go" onClick={copy}>
            Copy link
          </button>
        </div>

        {blockers.length > 0 && (
          <div className="ins-pub-warn" role="alert">
            <b>Clients can see your page, but can’t pay you yet.</b>
            <ul>
              {blockers.map((s) => (
                <li key={s.key}>
                  <Link href={s.href}>{s.label}</Link> · {s.why}
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="ins-pub-ig">
          <summary>How to add it to your Instagram bio</summary>
          <ol>
            <li>Open Instagram and go to your profile.</li>
            <li>Tap Edit profile, then Links, then Add external link.</li>
            <li>Paste your link and tap Done.</li>
          </ol>
        </details>

        <div className="ins-actions">
          <a href={pagePath} target="_blank" rel="noreferrer" className="ins-btn">
            View your page
          </a>
          <button type="button" className="ins-btn" onClick={onEdit}>
            Edit details
          </button>
          <Link href={OFFERS_PATH} className="ins-btn quiet">
            Manage offers
          </Link>
          {confirmUnpublish ? (
            <span className="ins-offer-confirm" role="group" aria-label="Confirm unpublish">
              <span>Hide your page from clients?</span>
              <button
                type="button"
                className="ins-btn ins-btn-bad"
                disabled={busy}
                onClick={async () => {
                  if (await toggle(false)) {
                    setConfirmUnpublish(false);
                    toast('Your page is hidden');
                  }
                }}
              >
                Unpublish
              </button>
              <button type="button" className="ins-btn quiet" onClick={() => setConfirmUnpublish(false)}>
                Keep live
              </button>
            </span>
          ) : (
            <button type="button" className="ins-btn quiet ins-offer-del" onClick={() => setConfirmUnpublish(true)}>
              Unpublish
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="ins-panel ins-sf-done ins-in d2" aria-labelledby="pub-title" aria-live="polite">
      <span className="ins-label">{ready ? 'Ready to publish' : 'Not public yet'}</span>
      <h2 id="pub-title">
        <span className="ins-num">{link}</span> is yours.
      </h2>
      <p>
        {ready
          ? 'Everything’s in place. Publish to make your page public, then put the link in your Instagram bio.'
          : 'Finish these steps and you can publish it. Until then, only you can see it.'}
      </p>

      <ol className="ins-sf-steps">
        {steps.map((s, i) => (
          <li key={s.key} className={s.done ? 'done' : ''}>
            {s.done ? <Icon name="check" className="ins-i sm" /> : <span className="ins-sf-step-n">{i + 1}</span>}
            {s.done ? (
              s.label
            ) : (
              <span className="ins-pub-step">
                <Link href={s.href}>{s.label}</Link>
                <span>{s.why}</span>
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="ins-actions">
        <button
          type="button"
          className="ins-btn go"
          onClick={publish}
          disabled={!ready || busy}
          aria-describedby={ready ? undefined : 'publish-why'}
        >
          {busy ? 'Publishing…' : 'Publish storefront'}
          {!busy && <Icon name="arrow" />}
        </button>
        <a href={pagePath} target="_blank" rel="noreferrer" className="ins-btn">
          Preview your page
        </a>
        <button type="button" className="ins-btn quiet" onClick={onEdit}>
          Edit details
        </button>
      </div>
      {!ready && (
        <p className="ins-pub-why" id="publish-why">
          {!blockers[0]
            ? 'Checking whether your storefront can go live…'
            : blockers[0].key === 'payouts'
            ? 'Publishing unlocks once payouts are ready, so every client who pays you actually gets paid out.'
            : `Next: ${blockers[0].label.toLowerCase()}.`}
        </p>
      )}
    </section>
  );
}
