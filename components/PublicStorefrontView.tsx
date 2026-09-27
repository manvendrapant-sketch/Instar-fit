import Link from 'next/link';
import type { CoachPublicProfile } from '@/lib/commerce/types';
import { Icon } from '@/lib/icons';
import { locationLine, STOREFRONT_PATH, storefrontLink } from '@/lib/storefront';
import { PublicOfferList } from '@/components/PublicOfferList';
import { CheckoutOutcomeBanner, type CheckoutOutcome } from '@/components/CheckoutOutcomeBanner';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
}

export type PublicBanner = 'owner-live' | 'owner-preview' | null;

/**
 * A coach's public storefront at /<handle>, from GET /api/coach/[handle]. Mobile first: nearly
 * every visit comes from an Instagram bio link. Renders on the server; only the offer buttons are
 * interactive (PublicOfferList).
 */
export function PublicStorefrontView({
  profile,
  banner,
  checkoutOutcome,
}: {
  profile: CoachPublicProfile;
  banner: PublicBanner;
  checkoutOutcome?: CheckoutOutcome | null;
}) {
  const where = locationLine(profile);
  return (
    <main className="ins-pub">
      {checkoutOutcome && <CheckoutOutcomeBanner outcome={checkoutOutcome} pathname={`/${profile.handle}`} />}
      {banner && (
        <div className={`ins-pub-banner ${banner === 'owner-live' ? 'live' : ''}`} role="status">
          <span>
            {banner === 'owner-live' ? (
              <>
                <b>Your page is live.</b> This is what clients see at {storefrontLink(profile.handle)}.
              </>
            ) : (
              <>
                <b>Preview.</b> Only you can see this until you publish.
              </>
            )}
          </span>
          <Link href={STOREFRONT_PATH}>{banner === 'owner-live' ? 'Edit' : 'Back to publish'}</Link>
        </div>
      )}

      <header className="ins-pub-profile">
        <span className="ins-sf-avatar ins-pub-avatar" aria-hidden="true">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" />
          ) : (
            initials(profile.displayName) || <Icon name="user" />
          )}
        </span>
        <h1>{profile.displayName}</h1>
        {profile.specialties.length > 0 && (
          <ul className="ins-sf-tags" aria-label="Specialties">
            {profile.specialties.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        {where && (
          <span className="ins-sf-where">
            <Icon name="network" className="ins-i sm" />
            {where}
          </span>
        )}
        {profile.bio && <p>{profile.bio}</p>}
      </header>

      <section className="ins-pub-offers" aria-labelledby="pub-offers">
        <h2 className="ins-label" id="pub-offers">
          Work with {profile.displayName.split(' ')[0] || 'me'}
        </h2>
        {profile.offers.length > 0 ? (
          <PublicOfferList offers={profile.offers} />
        ) : (
          <div className="ins-sf-empty">
            <Icon name="offers" />
            <span>No offers yet. Check back soon.</span>
          </div>
        )}
      </section>

      <PublicFooter />
    </main>
  );
}

/** Unknown or unpublished handle ("not_found"), or the API failed ("error"). */
export function PublicUnavailable({ handle, reason }: { handle: string; reason: 'not_found' | 'error' }) {
  return (
    <main className="ins-pub ins-pub-missing">
      <span className="ins-label">{storefrontLink(handle)}</span>
      <h1>{reason === 'error' ? 'This page didn’t load' : 'There’s no coach here yet'}</h1>
      <p>
        {reason === 'error'
          ? 'Something went wrong on our side. Try again in a moment.'
          : 'Check the link, or ask your coach to send it again.'}
      </p>
      {reason === 'error' ? (
        <a href={`/${handle}`} className="ins-btn">
          Try again
        </a>
      ) : (
        <Link href="/signup" className="ins-btn">
          Are you a coach? Start your storefront
        </Link>
      )}
      <PublicFooter />
    </main>
  );
}

function PublicFooter() {
  return (
    <footer className="ins-pub-foot">
      <span>
        <Icon name="lock" className="ins-i sm" />
        Secure checkout by Stripe
      </span>
      <Link href="/signup" className="ins-mark ins-pub-mark" aria-label="Powered by Instar">
        <span className="glyph" aria-hidden="true" />
        Powered by Instar
      </Link>
    </footer>
  );
}
