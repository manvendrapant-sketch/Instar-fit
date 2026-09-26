'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { createAccountLink, PAYOUTS_CONNECT_PATH, PAYOUTS_PATH, PAYOUTS_RETURN_PATH } from '@/lib/payouts';

/** The step before Stripe: asks the server for an Express account link and redirects to it. */
export function PayoutsConnect() {
  const { payouts, toast } = useAppState();
  const [handingOff, setHandingOff] = useState(false);
  const resuming = payouts.status === 'action_needed';

  async function onContinue() {
    setHandingOff(true);
    const result = await createAccountLink({ returnPath: PAYOUTS_RETURN_PATH, refreshPath: PAYOUTS_CONNECT_PATH });
    if (!result.ok) {
      setHandingOff(false);
      toast(result.message);
      return;
    }
    window.location.href = result.url;
  }

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
            <button type="button" className="ins-btn go" onClick={onContinue} disabled={handingOff}>
              {handingOff ? 'Redirecting…' : 'Continue to Stripe'}
              <Icon name="arrow" />
            </button>
            <Link href={PAYOUTS_PATH} className="ins-btn quiet">
              Not now
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
