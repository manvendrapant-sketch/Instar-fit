'use client';

import Link from 'next/link';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { OfferCard } from '@/components/OfferCard';
import { resolvePublicView, type PublicStorefront } from '@/lib/publicStorefront';
import { STOREFRONT_PATH, storefrontLink } from '@/lib/storefront';

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
}

/**
 * A coach's public storefront at /<handle>. Mobile first: nearly every visit comes from an
 * Instagram bio link. Data comes from resolvePublicView until GET /api/coach/[handle] exists.
 */
export function PublicStorefrontView({ handle }: { handle: string }) {
  const { storefront, offers, storefrontPublished, hydrated, toast } = useAppState();
  if (!hydrated) return <main className="ins-pub" aria-busy="true" />;

  const view = resolvePublicView(handle, { storefront, offers, published: storefrontPublished });

  if (view.kind === 'not_found') {
    return (
      <main className="ins-pub ins-pub-missing">
        <span className="ins-label">{storefrontLink(handle)}</span>
        <h1>There’s no coach here yet</h1>
        <p>Check the link, or ask your coach to send it again.</p>
        <Link href="/signup" className="ins-btn">
          Are you a coach? Start your storefront
        </Link>
        <Footer />
      </main>
    );
  }

  const s = view.storefront;
  // Checkout is Sprint 3; until then the button explains itself instead of doing nothing.
  const onSelect = () => toast('Checkout is coming soon. You’ll pay by card, Apple Pay or Google Pay.');

  return (
    <main className="ins-pub">
      {view.kind === 'owner' && (
        <div className={`ins-pub-banner ${view.live ? 'live' : ''}`} role="status">
          <span>
            {view.live ? (
              <>
                <b>Your page is live.</b> This is what clients see at {storefrontLink(s.handle)}.
              </>
            ) : (
              <>
                <b>Preview.</b> Only you can see this until you publish.
              </>
            )}
          </span>
          <Link href={STOREFRONT_PATH}>{view.live ? 'Edit' : 'Back to publish'}</Link>
        </div>
      )}
      {view.kind === 'demo' && (
        <div className="ins-pub-banner" role="status">
          <span>
            <b>Sample storefront.</b> A demo coach, so you can see what clients get.
          </span>
          <Link href="/signup">Make yours</Link>
        </div>
      )}

      <Profile s={s} />

      <section className="ins-pub-offers" aria-labelledby="pub-offers">
        <h2 className="ins-label" id="pub-offers">
          Work with {s.displayName.split(' ')[0] || 'me'}
        </h2>
        {s.offers.length > 0 ? (
          s.offers.map((o) => <OfferCard key={o.id} offer={o} onSelect={onSelect} />)
        ) : (
          <div className="ins-sf-empty">
            <Icon name="offers" />
            <span>No offers yet. Check back soon.</span>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

function Profile({ s }: { s: PublicStorefront }) {
  return (
    <header className="ins-pub-profile">
      <span className="ins-sf-avatar ins-pub-avatar" aria-hidden="true">
        {s.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatarUrl} alt="" />
        ) : (
          initials(s.displayName) || <Icon name="user" />
        )}
      </span>
      <h1>{s.displayName}</h1>
      {s.specialties.length > 0 && (
        <ul className="ins-sf-tags" aria-label="Specialties">
          {s.specialties.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {s.where && (
        <span className="ins-sf-where">
          <Icon name="network" className="ins-i sm" />
          {s.where}
        </span>
      )}
      {s.bio && <p>{s.bio}</p>}
    </header>
  );
}

function Footer() {
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
