'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Icon } from '@/lib/icons';
import { useAppState } from '@/lib/store';
import { STOREFRONT_PATH } from '@/lib/storefront';

type Placement = { mode: 'anchored'; top: number; left: number; arrow: number } | { mode: 'docked' };

const GAP = 14;
const EDGE = 16;

/**
 * Coachmark on Today pointing at the sidebar's Storefront item until the coach has created a
 * storefront. Anchored beside the nav item on desktop; docked to the bottom of the screen when
 * the sidebar is collapsed (phones) or the item is scrolled out of view.
 */
export function StorefrontPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const { storefront, storefrontPromptDismissed, dismissStorefrontPrompt, navOpen } = useAppState();
  const [ready, setReady] = useState(false);
  const [placement, setPlacement] = useState<Placement>({ mode: 'docked' });
  const cardRef = useRef<HTMLDivElement>(null);

  const visible = ready && pathname === '/' && !storefront && !storefrontPromptDismissed && !navOpen;

  // Let Today's entrance animation land first, and wait for the stored state to hydrate.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(t);
  }, []);

  const place = useCallback(() => {
    const anchor = document.querySelector<HTMLElement>('[data-nav="storefront"]');
    const card = cardRef.current;
    if (!anchor || !card) return;
    const r = anchor.getBoundingClientRect();
    const shown = anchor.offsetParent !== null && window.innerWidth > 760;
    const inView = r.top >= 76 && r.bottom <= window.innerHeight;
    if (!shown || !inView) {
      setPlacement({ mode: 'docked' });
      return;
    }
    const h = card.offsetHeight;
    const center = r.top + r.height / 2;
    const top = Math.max(EDGE + 76, Math.min(center - 44, window.innerHeight - h - EDGE));
    setPlacement({ mode: 'anchored', top, left: r.right + GAP, arrow: center - top });
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    // Measuring the anchor and positioning the card is what a layout effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    place();
    const scroller = document.querySelector('.ins-dir-scroll');
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    scroller?.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
      scroller?.removeEventListener('scroll', place);
    };
  }, [visible, place]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissStorefrontPrompt();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismissStorefrontPrompt]);

  // Highlight the nav item the popup points at.
  useEffect(() => {
    const anchor = document.querySelector<HTMLElement>('[data-nav="storefront"]');
    anchor?.classList.toggle('spot', visible && placement.mode === 'anchored');
    return () => anchor?.classList.remove('spot');
  }, [visible, placement.mode]);

  if (!visible) return null;

  const go = () => router.push(STOREFRONT_PATH);
  // Clicking anywhere on the card opens storefront creation; the buttons handle themselves.
  const onCardClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button')) go();
  };

  const style =
    placement.mode === 'anchored'
      ? { top: placement.top, left: placement.left, ['--arrow' as string]: `${placement.arrow}px` }
      : undefined;

  return (
    <div
      ref={cardRef}
      className={`ins-sf-prompt ${placement.mode}`}
      style={style}
      role="dialog"
      aria-labelledby="sf-prompt-title"
      aria-describedby="sf-prompt-body"
      onClick={onCardClick}
    >
      <div className="ins-sf-prompt-top">
        <span className="ins-sf-prompt-icon" aria-hidden="true">
          <Icon name="storefront" />
        </span>
        <span className="ins-label">Next step</span>
      </div>
      <h3 id="sf-prompt-title">Create your storefront</h3>
      <p id="sf-prompt-body">
        Your storefront is the one link where clients find your offers, book and pay you. It takes about two minutes.
      </p>
      <div className="ins-actions">
        <button type="button" className="ins-btn go" onClick={go}>
          Create storefront
          <Icon name="arrow" />
        </button>
        <button type="button" className="ins-btn quiet" onClick={dismissStorefrontPrompt}>
          Later
        </button>
      </div>
    </div>
  );
}
