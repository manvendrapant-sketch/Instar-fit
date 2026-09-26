'use client';

import Link from 'next/link';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';

export function TopBar() {
  const { setCmdOpen, setNavOpen, navOpen, theme, setTheme } = useAppState();

  return (
    <header className="ins-bar">
      <Link href="/" className="ins-mark" aria-label="Instar, go to Today">
        <span className="glyph" aria-hidden="true" />
        Instar
      </Link>
      <button className="ins-ask" onClick={() => setCmdOpen(true)} aria-haspopup="dialog">
        <Icon name="search" />
        <span className="t">Search or ask anything</span>
        <span className="k">{'⌘K'}</span>
      </button>
      <div className="ins-bar-r">
        <div className="ins-theme-toggle" role="group" aria-label="Theme">
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
            Dark
          </button>
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
            Light
          </button>
        </div>
        <button
          className="ins-menu"
          aria-label="Open directory"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(!navOpen)}
        >
          <Icon name="menu" />
        </button>
        <span className="ins-me" aria-label="Maya Reyes">
          MR
        </span>
      </div>
    </header>
  );
}
