'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { initialsFor, logout } from '@/lib/auth';
import { Icon, type IconName } from '@/lib/icons';
import { SPACES, QUEUE } from '@/lib/data';
import { useAppState } from '@/lib/store';
import { STOREFRONT_PATH } from '@/lib/storefront';
import { OFFERS_PATH } from '@/lib/offers';
import { PAYOUTS_PATH } from '@/lib/payouts';
import { CLIENTS_PATH } from '@/lib/coachClients';
import { DISPUTES_PATH } from '@/lib/disputes';

const SPACE_COUNTS: Record<string, string> = {
  roster: '36',
  checkins: '3',
  pipeline: '48',
  outreach: '6',
};

export function Sidebar({ coach }: { coach: { displayName: string; email: string } }) {
  const pathname = usePathname();
  const { done, setNavOpen, storefront, offers, payouts, storefrontStatus } = useAppState();
  const [loggingOut, setLoggingOut] = useState(false);
  const left = QUEUE.length - done.length;

  const close = () => setNavOpen(false);

  async function onLogout() {
    setLoggingOut(true);
    await logout();
    // A full reload, not router.push+refresh: refresh() only re-renders server components, but
    // AppStateProvider's offers/payouts/storefront state is client-side and only ever fetched
    // once on mount — a client-side navigation leaves it stale (the previous account's data)
    // until something remounts the whole tree. A full reload is the only thing that reliably does.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload, see above
    window.location.href = '/login';
  }

  return (
    <nav className="ins-dir-scroll" aria-label="Directory">
      <div className="ins-dir">
        <Link
          href="/"
          className={`ins-nav ${pathname === '/' ? 'on' : ''}`}
          aria-current={pathname === '/' ? 'page' : undefined}
          onClick={close}
        >
          <Icon name="today" />
          Today
          {left > 0 && <span className="pip ins-num">{left}</span>}
        </Link>

        {SPACES.map((space) => {
          const spaceActive = pathname.startsWith(`/${space.id}`);
          return (
            <div key={space.id}>
              <div className="ins-grp">
                {space.title}
                <span aria-hidden="true">{spaceActive ? '•' : ''}</span>
              </div>
              {space.tiles.map((tile) => {
                if (tile.id === 'payouts') {
                  const on = pathname.startsWith(PAYOUTS_PATH);
                  // Payouts is step 3: only nudge once there's an offer to get paid for.
                  const marker =
                    payouts.status === 'action_needed' ? 'Action' : payouts.status === 'pending_review' ? 'Review' : payouts.status === 'not_started' && offers.length > 0 ? 'Set up' : null;
                  return (
                    <Link
                      key={tile.id}
                      href={PAYOUTS_PATH}
                      className={`ins-nav ${on ? 'on' : ''}`}
                      aria-current={on ? 'page' : undefined}
                      onClick={close}
                    >
                      <Icon name="payouts" />
                      {tile.title}
                      {marker && <span className={`ins-nav-setup ${payouts.status === 'action_needed' ? 'warn' : ''}`}>{marker}</span>}
                    </Link>
                  );
                }
                if (tile.id === 'offers') {
                  const on = pathname.startsWith(OFFERS_PATH);
                  return (
                    <Link
                      key={tile.id}
                      href={OFFERS_PATH}
                      className={`ins-nav ${on ? 'on' : ''}`}
                      aria-current={on ? 'page' : undefined}
                      onClick={close}
                    >
                      <Icon name="offers" />
                      {tile.title}
                      {offers.length > 0 && <span className="n">{offers.length}</span>}
                    </Link>
                  );
                }
                if (tile.id === 'subscribers') {
                  const on = pathname.startsWith(CLIENTS_PATH);
                  return (
                    <Link
                      key={tile.id}
                      href={CLIENTS_PATH}
                      className={`ins-nav ${on ? 'on' : ''}`}
                      aria-current={on ? 'page' : undefined}
                      onClick={close}
                    >
                      <Icon name="roster" />
                      {tile.title}
                    </Link>
                  );
                }
                if (tile.id === 'disputes') {
                  const on = pathname.startsWith(DISPUTES_PATH);
                  return (
                    <Link
                      key={tile.id}
                      href={DISPUTES_PATH}
                      className={`ins-nav ${on ? 'on' : ''}`}
                      aria-current={on ? 'page' : undefined}
                      onClick={close}
                    >
                      <Icon name="alert" />
                      {tile.title}
                    </Link>
                  );
                }
                if (tile.id === 'storefront') {
                  const on = pathname === STOREFRONT_PATH;
                  return (
                    <Link
                      key={tile.id}
                      href={STOREFRONT_PATH}
                      className={`ins-nav ${on ? 'on' : ''}`}
                      aria-current={on ? 'page' : undefined}
                      data-nav="storefront"
                      onClick={close}
                    >
                      <Icon name="storefront" />
                      {tile.title}
                      {!storefront?.completed ? (
                        <span className="ins-nav-setup">Set up</span>
                      ) : (
                        storefrontStatus?.published && <span className="ins-nav-setup ok">Live</span>
                      )}
                    </Link>
                  );
                }
                return (
                  <Link key={tile.id} href={`/${space.id}#${tile.id}`} className="ins-nav" onClick={close}>
                    <Icon name={tile.id as IconName} />
                    {tile.title}
                    {SPACE_COUNTS[tile.id] && <span className="n">{SPACE_COUNTS[tile.id]}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}

        <div className="ins-dir-foot">
          <span className="ins-me" style={{ width: 34, height: 34, fontSize: 12 }}>
            {initialsFor(coach.displayName)}
          </span>
          <span className="ins-dir-foot-info">
            <b>{coach.displayName}</b>
            Starter plan
          </span>
          <button type="button" className="ins-logout" onClick={onLogout} disabled={loggingOut} aria-label="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </nav>
  );
}
