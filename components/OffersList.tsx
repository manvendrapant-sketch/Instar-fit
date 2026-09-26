'use client';

import Link from 'next/link';
import type { OfferType } from '@/lib/commerce/types';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { STOREFRONT_PATH } from '@/lib/storefront';
import { formatOfferPrice, OFFER_TYPES, OFFERS_PATH } from '@/lib/offers';
import { isPayoutsReady, PAYOUTS_PATH, STATUS_COPY } from '@/lib/payouts';

const QUICK_STARTS: OfferType[] = ['subscription', 'one_time', 'session'];

export function OffersList() {
  const { offers, reorderOffer, saveOffer, storefront, hydrated, payouts } = useAppState();
  const live = offers.filter((o) => o.visible).length;

  return (
    <>
      <section className="ins-space-hero ins-sf-hero">
        <div>
          <div className="ins-label ins-in" style={{ marginBottom: 18 }}>
            Business · Offers
          </div>
          <h1 className="ins-in d1">Offers</h1>
          <p className="ins-in d2">
            The coaching, programs and sessions you sell. They show on your storefront in this order.
          </p>
        </div>
        {offers.length > 0 && (
          <Link href={`${OFFERS_PATH}/new`} className="ins-btn go ins-in d2">
            <Icon name="plus" />
            New offer
          </Link>
        )}
      </section>

      {/* Stays until payouts exist: it's the step that blocks publishing. */}
      {hydrated && offers.length > 0 && !isPayoutsReady(payouts) && (
        <section className="ins-panel ins-offers-next ins-in" aria-labelledby="next-title">
          <span className="ins-sf-prompt-icon" aria-hidden="true">
            <Icon name="payouts" />
          </span>
          <div>
            <span className="ins-label">Next step · payouts {STATUS_COPY[payouts.status].chip.toLowerCase()}</span>
            <h2 id="next-title">
              {payouts.status === 'pending_review' ? 'Stripe is checking your details' : 'Connect payouts so clients can pay you'}
            </h2>
            <p>
              {payouts.status === 'pending_review'
                ? 'Nothing to do right now. Your storefront can go live as soon as Stripe approves you.'
                : 'You’ll add your bank details on Stripe’s secure page, not in Instar. Verification can take a day, so it’s worth starting soon. Your storefront goes live once payouts are ready.'}
            </p>
            {payouts.status !== 'pending_review' && (
              <div className="ins-actions" style={{ marginTop: 14 }}>
                <Link href={PAYOUTS_PATH} className="ins-btn go">
                  {payouts.status === 'action_needed' ? 'Finish payouts setup' : 'Connect payouts'}
                  <Icon name="arrow" />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {hydrated && !storefront && offers.length > 0 && (
        <p className="ins-offers-note ins-in">
          Clients will see these on your storefront. <Link href={STOREFRONT_PATH}>Create your storefront</Link> to get your link.
        </p>
      )}

      {!hydrated ? null : offers.length === 0 ? (
        <section className="ins-panel ins-offers-empty ins-in d2" aria-labelledby="empty-title">
          <span className="ins-sf-prompt-icon lg" aria-hidden="true">
            <Icon name="offers" />
          </span>
          <h2 id="empty-title">Add your first offer</h2>
          <p>Pick what you sell. You can add more, change prices or hide an offer any time.</p>
          <div className="ins-offers-quick">
            {QUICK_STARTS.map((t) => (
              <Link key={t} href={`${OFFERS_PATH}/new?type=${t}`} className="ins-offers-quick-it">
                <b>{OFFER_TYPES[t].label}</b>
                <span>{OFFER_TYPES[t].blurb}</span>
                <span className="ins-offers-eg">e.g. {OFFER_TYPES[t].example}</span>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="ins-panel ins-in d2" aria-labelledby="list-title">
          <div className="ins-panel-h">
            <h2 id="list-title">Your offers</h2>
            <span className="ins-label ins-num">
              {live} of {offers.length} on storefront
            </span>
          </div>
          <ol className="ins-offers-list">
            {offers.map((o, i) => (
              <li key={o.id} className={`ins-offers-row ${o.visible ? '' : 'hidden'}`}>
                <div className="ins-offers-order">
                  <button
                    type="button"
                    className="ins-input-btn"
                    onClick={() => reorderOffer(o.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${o.name} up`}
                  >
                    <Icon name="up" />
                  </button>
                  <button
                    type="button"
                    className="ins-input-btn"
                    onClick={() => reorderOffer(o.id, 1)}
                    disabled={i === offers.length - 1}
                    aria-label={`Move ${o.name} down`}
                  >
                    <Icon name="down" />
                  </button>
                </div>
                <Link href={`${OFFERS_PATH}/${o.id}`} className="ins-offers-main">
                  <span className="ins-offers-title">
                    <b>{o.name}</b>
                    <span>
                      {OFFER_TYPES[o.type].label}
                      {o.description ? ` · ${o.description}` : ''}
                    </span>
                  </span>
                  <span className="ins-q-value ins-num">{formatOfferPrice(o)}</span>
                </Link>
                <button
                  type="button"
                  className={`ins-offers-vis ${o.visible ? 'on' : ''}`}
                  onClick={() => saveOffer({ ...o, visible: !o.visible })}
                  aria-pressed={o.visible}
                  aria-label={o.visible ? `Hide ${o.name} from storefront` : `Show ${o.name} on storefront`}
                >
                  <Icon name={o.visible ? 'eye' : 'eyeoff'} />
                  <span>{o.visible ? 'Shown' : 'Hidden'}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
