import { Icon } from '@/lib/icons';
import { formatOfferPrice, OFFER_TYPES, type OfferDraft } from '@/lib/offers';

/** An offer as clients see it on the storefront. Used in the storefront preview and the builder. */
export function OfferCard({ offer, compact = false }: { offer: OfferDraft; compact?: boolean }) {
  const hasPrice = offer.price.unitAmountCents > 0;
  return (
    <article className={`ins-offer-card ${compact ? 'compact' : ''}`}>
      <span className="ins-label">{OFFER_TYPES[offer.type].short}</span>
      <b className={`ins-offer-name ${offer.name ? '' : 'ph'}`}>{offer.name || 'Offer name'}</b>
      <span className={`ins-offer-price ins-num ${hasPrice ? '' : 'ph'}`}>
        {hasPrice ? formatOfferPrice(offer) : 'Price'}
      </span>
      {!compact && offer.description && <p className="ins-offer-desc">{offer.description}</p>}
      {!compact && offer.includes.filter(Boolean).length > 0 && (
        <ul className="ins-offer-inc">
          {offer.includes.filter((i) => i.trim()).map((item, i) => (
            <li key={i}>
              <Icon name="check" className="ins-i sm" />
              {item}
            </li>
          ))}
        </ul>
      )}
      <span className="ins-offer-cta" aria-hidden="true">
        {offer.type === 'session' ? 'Book' : offer.type === 'subscription' ? 'Start' : 'Get the program'}
      </span>
    </article>
  );
}
