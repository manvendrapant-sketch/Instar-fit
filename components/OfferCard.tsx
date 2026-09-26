import { Icon } from '@/lib/icons';
import { formatOfferPrice, OFFER_TYPES, type OfferDraft } from '@/lib/offers';

export function offerCta(type: OfferDraft['type']) {
  return type === 'session' ? 'Book' : type === 'subscription' ? 'Start' : 'Get the program';
}

/**
 * An offer as clients see it on the storefront. In the coach's previews the button is decorative;
 * on the public page `onSelect` makes it a real button that starts checkout.
 */
export function OfferCard({
  offer,
  compact = false,
  onSelect,
}: {
  offer: OfferDraft;
  compact?: boolean;
  onSelect?: (offer: OfferDraft) => void;
}) {
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
      {onSelect ? (
        <button type="button" className="ins-offer-cta" onClick={() => onSelect(offer)} aria-label={`${offerCta(offer.type)}: ${offer.name}`}>
          {offerCta(offer.type)}
        </button>
      ) : (
        <span className="ins-offer-cta" aria-hidden="true">
          {offerCta(offer.type)}
        </span>
      )}
    </article>
  );
}
