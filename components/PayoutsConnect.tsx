'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { MOCK_RESULTS, PAYOUTS_PATH, PAYOUTS_RETURN_PATH, type MockStripeResult } from '@/lib/payouts';

/**
 * The step before Stripe. In the real app, "Continue to Stripe" asks the server for an Express
 * account link and redirects to it; Stripe sends the coach back to PAYOUTS_RETURN_PATH. Until
 * that route exists, a clearly marked stand-in lets you pick what Stripe would report.
 */
export function PayoutsConnect() {
  const { payouts } = useAppState();
  const [handingOff, setHandingOff] = useState(false);
  const resuming = payouts.status === 'action_needed';

  return (
    <>
      <section className="ins-space-hero ins-sf-hero">
        <div>
          <Link href={PAYOUTS_PATH} className="ins-label ins-offers-back ins-in">
            ← Payouts
          </Link>
          <h1 className="ins-in d1">{resuming ? 'Finish on Stripe' : 'Connect payouts'}</h1>
          <p className="ins-in d2">
            {resuming
              ? 'Stripe keeps what you’ve already entered and only asks for what’s missing.'
              : 'You’ll set this up on Stripe’s secure page, then come straight back here.'}
          </p>
        </div>
      </section>

      <div className="ins-po-connect">
        <section className="ins-panel ins-po-card ins-in d2" aria-labelledby="pc-title">
          <h2 id="pc-title">Before you go</h2>
          <ul className="ins-po-list">
            <li>
              <Icon name="lock" className="ins-i sm" />
              Stripe is the payments company behind millions of businesses. Your bank, ID and tax details go to them, not Instar.
            </li>
            <li>
              <Icon name="today" className="ins-i sm" />
              It takes about 5 minutes. Have your bank details and a photo ID nearby.
            </li>
            <li>
              <Icon name="check" className="ins-i sm" />
              When you’re done, Stripe brings you back here and we’ll show where things stand.
            </li>
          </ul>
          <div className="ins-actions">
            <button type="button" className="ins-btn go" onClick={() => setHandingOff(true)} disabled={handingOff}>
              Continue to Stripe
              <Icon name="arrow" />
            </button>
            <Link href={PAYOUTS_PATH} className="ins-btn quiet">
              Not now
            </Link>
          </div>
        </section>

        {handingOff && (
          <section className="ins-po-proto ins-po-standin ins-in" aria-labelledby="pc-standin" aria-live="polite">
            <span className="ins-label" id="pc-standin">
              Prototype · stands in for Stripe’s onboarding
            </span>
            <p>
              In the real app you’d be on Stripe’s page now. Pick what happened there to see the screen you’d come back to.
            </p>
            <div className="ins-po-results">
              {(Object.keys(MOCK_RESULTS) as MockStripeResult[]).map((r) => (
                <Link key={r} href={`${PAYOUTS_RETURN_PATH}?mock=${r}`} className="ins-btn">
                  {MOCK_RESULTS[r]}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
