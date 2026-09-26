'use client';

import { HERO_STATS, QUEUE } from '@/lib/data';
import { useAppState } from '@/lib/store';

export function HeroGreeting() {
  const { done } = useAppState();
  const left = QUEUE.length - done.length;

  return (
    <section className="ins-hero">
      <div>
        <div className="eyebrow ins-label ins-in">
          <span className="live" aria-hidden="true" />
          Tuesday 22 September {'·'} 7:42 AM
        </div>
        <h1 className="ins-in d1">
          Good morning, Maya.{' '}
          <span className="dim">
            {left > 0 ? (
              <>
                <em>
                  {left} {left === 1 ? 'thing' : 'things'}
                </em>{' '}
                need you today.
              </>
            ) : (
              'Nothing needs you right now.'
            )}
          </span>
        </h1>
      </div>
      <div className="ins-stats ins-in d2">
        {HERO_STATS.map((s) => (
          <div key={s.label}>
            <b className="ins-num">{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
