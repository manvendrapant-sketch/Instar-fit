'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/lib/icons';
import { SPACES, QUEUE } from '@/lib/data';
import { useAppState } from '@/lib/store';
import { STOREFRONT_PATH } from '@/lib/storefront';

const SPACE_COUNTS: Record<string, string> = {
  roster: '36',
  checkins: '3',
  pipeline: '48',
  outreach: '6',
};

export function Sidebar() {
  const pathname = usePathname();
  const { done, setNavOpen, storefront } = useAppState();
  const left = QUEUE.length - done.length;

  const close = () => setNavOpen(false);

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
                      {!storefront && <span className="ins-nav-setup">Set up</span>}
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
            MR
          </span>
          <span>
            <b>Maya Reyes</b>
            Starter plan
          </span>
        </div>
      </div>
    </nav>
  );
}
