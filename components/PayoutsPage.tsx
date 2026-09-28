'use client';

import Link from 'next/link';
import type { ConnectStatus } from '@/lib/commerce/types';
import { Icon } from '@/lib/icons';
import { LoadingSection } from '@/components/LoadingSection';
import { PayoutDashboard } from '@/components/PayoutDashboard';
import { useAppState } from '@/lib/store';
import { STOREFRONT_PATH } from '@/lib/storefront';
import { OFFERS_PATH } from '@/lib/offers';
import { isPayoutsReady, PAYOUT_STEPS, PAYOUTS_CONNECT_PATH, requirementLabels, STATUS_COPY, stepIndex } from '@/lib/payouts';

const CHIP_KIND: Record<ConnectStatus, string> = {
  not_started: 'k-renew',
  action_needed: 'k-quiet',
  pending_review: 'k-checkin',
  ready: 'k-lead',
};

const YOU_NEED = [
  'Your legal name, date of birth and home address',
  'Last 4 digits of your SSN (Stripe may ask for the full number)',
  'The bank account you want paid into (routing and account number)',
  'A photo ID, if Stripe can’t verify you from the above',
];

function PayoutsHero() {
  return (
    <section className="ins-space-hero ins-sf-hero">
      <div>
        <div className="ins-label ins-in" style={{ marginBottom: 18 }}>
          Business · Payouts
        </div>
        <h1 className="ins-in d1">Payouts</h1>
        <p className="ins-in d2">How client payments reach your bank. Instar uses Stripe, so your bank and ID details stay with them.</p>
      </div>
    </section>
  );
}

export function PayoutsPage() {
  const { payouts, hydrated, storefront, storefrontStatus, offers } = useAppState();
  if (!hydrated) {
    return (
      <>
        <PayoutsHero />
        <LoadingSection label="Loading your payouts…" />
      </>
    );
  }

  const { status } = payouts;
  const copy = STATUS_COPY[status];
  const current = stepIndex(status);
  const ready = isPayoutsReady(payouts);
  const due = requirementLabels(payouts.requirementsDue);

  // Connected: this page becomes the money view (Sprint 5), with a nudge above it while the
  // storefront isn't live, since there's no money to show until clients can buy.
  if (ready) {
    return (
      <>
        <PayoutsHero />
        {!storefrontStatus?.published && (
          <section className="ins-panel ins-offers-next ins-in d1" aria-labelledby="po-next">
            <span className="ins-sf-prompt-icon" aria-hidden="true">
              <Icon name="storefront" />
            </span>
            <div>
              <span className="ins-label">Next step</span>
              <h2 id="po-next">{storefront?.completed ? 'Publish your storefront' : 'Create your storefront'}</h2>
              <p>
                {storefront?.completed
                  ? 'You can get paid now. Publish your storefront and put the link in your Instagram bio.'
                  : 'You can get paid now. Create your storefront so clients have somewhere to buy.'}
              </p>
              <div className="ins-actions" style={{ marginTop: 14 }}>
                <Link href={STOREFRONT_PATH} className="ins-btn go">
                  {storefront?.completed ? 'Go to storefront' : 'Create storefront'}
                  <Icon name="arrow" />
                </Link>
              </div>
            </div>
          </section>
        )}
        <PayoutDashboard />
      </>
    );
  }

  return (
    <>
      <PayoutsHero />

      <div className="ins-sf-grid">
        <div className="ins-po-main">
          <section className={`ins-panel ins-po-card ins-in d2 ${status}`} aria-labelledby="po-title">
            <ol className="ins-po-steps" aria-label="Payout setup progress">
              {PAYOUT_STEPS.map((s, i) => (
                <li
                  key={s.key}
                  className={i < current || ready ? 'done' : i === current ? 'now' : ''}
                  aria-current={i === current ? 'step' : undefined}
                >
                  <span className="ins-po-dot">{i < current || ready ? <Icon name="check" className="ins-i sm" /> : i + 1}</span>
                  {s.label}
                </li>
              ))}
            </ol>

            <span className={`ins-chip ${CHIP_KIND[status]}`}>{copy.chip}</span>
            <h2 id="po-title">{copy.title}</h2>
            <p className="ins-po-body">{copy.body}</p>

            {status === 'not_started' && (
              <>
                <h3 className="ins-label ins-po-h">What Stripe will ask for</h3>
                <ul className="ins-po-list">
                  {YOU_NEED.map((t) => (
                    <li key={t}>
                      <Icon name="check" className="ins-i sm" />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="ins-actions">
                  <Link href={PAYOUTS_CONNECT_PATH} className="ins-btn go">
                    Connect payouts
                    <Icon name="arrow" />
                  </Link>
                </div>
              </>
            )}

            {status === 'action_needed' && (
              <>
                <h3 className="ins-label ins-po-h">Still needed</h3>
                <ul className="ins-po-list due">
                  {due.map((t) => (
                    <li key={t}>
                      <span className="ins-po-due-dot" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="ins-actions">
                  <Link href={PAYOUTS_CONNECT_PATH} className="ins-btn go">
                    Finish on Stripe
                    <Icon name="arrow" />
                  </Link>
                </div>
              </>
            )}

            {status === 'pending_review' && (
              <div className="ins-actions">
                <Link href={offers.length ? OFFERS_PATH : `${OFFERS_PATH}/new`} className="ins-btn">
                  {offers.length ? 'Review your offers' : 'Add an offer meanwhile'}
                </Link>
                <Link href={STOREFRONT_PATH} className="ins-btn quiet">
                  Polish your storefront
                </Link>
              </div>
            )}

          </section>

        </div>

        <aside className="ins-sf-preview ins-po-side ins-in d3" aria-labelledby="po-how">
          <section className="ins-panel ins-po-how">
            <h2 id="po-how">How you get paid</h2>
            <ol>
              <li>
                <b>A client pays on your storefront</b>
                <span>They see your price plus a separate service fee, and pay by card, Apple Pay or Google Pay.</span>
              </li>
              <li>
                <b>Stripe holds it briefly</b>
                <span>Instar keeps 2% of your price. The rest is yours.</span>
              </li>
              <li>
                <b>It lands in your bank</b>
                <span>Stripe pays out automatically, usually within 2 business days.</span>
              </li>
            </ol>
            <p className="ins-po-safe">
              <Icon name="lock" className="ins-i sm" />
              Instar never sees or stores your bank, ID or tax details.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
