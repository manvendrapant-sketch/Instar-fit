'use client';

import Link from 'next/link';
import { useAppState } from '@/lib/store';

export function AuthBar() {
  const { theme, setTheme } = useAppState();

  return (
    <header className="ins-bar">
      <Link href="/" className="ins-mark" aria-label="Instar home">
        <span className="glyph" aria-hidden="true" />
        Instar
      </Link>
      <div className="ins-bar-r">
        <div className="ins-theme-toggle" role="group" aria-label="Theme">
          <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
            Dark
          </button>
          <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
            Light
          </button>
        </div>
      </div>
    </header>
  );
}
