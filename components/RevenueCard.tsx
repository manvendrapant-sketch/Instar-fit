'use client';

import { useEffect, useRef, useState } from 'react';
import { REVENUE } from '@/lib/data';

const RING_RADIUS = 48;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function sparkPath() {
  const v = REVENUE.sparkline;
  const W = 440;
  const H = 64;
  const mn = 4;
  const mx = 9;
  const pts = v.map((y, i) => [(i * W) / (v.length - 1), H - 4 - ((y - mn) / (mx - mn)) * (H - 10)]);
  return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
}

export function RevenueCard() {
  const [display, setDisplay] = useState(0);
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(REVENUE.monthly);
      return;
    }
    const t0 = performance.now();
    const dur = 1100;
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(REVENUE.monthly * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (ringRef.current) {
      requestAnimationFrame(() => {
        if (ringRef.current) ringRef.current.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - REVENUE.goalPct));
      });
    }
  }, []);

  const line = sparkPath();

  return (
    <section className="ins-panel ins-money" aria-label="Revenue">
      <span className="ins-label">Monthly recurring revenue</span>
      <div className="ins-money-row">
        <div>
          <div className="ins-big ins-num">${display.toLocaleString('en-US')}</div>
          <div className="ins-delta">
            <b>{REVENUE.deltaPct}</b> {REVENUE.deltaLabel} {'·'} next payout {REVENUE.nextPayout}
          </div>
        </div>
        <div
          className="ins-ring"
          role="img"
          aria-label={`${Math.round(REVENUE.goalPct * 100)}% of the $${REVENUE.goal.toLocaleString()} monthly goal`}
        >
          <svg viewBox="0 0 108 108">
            <circle className="track" cx="54" cy="54" r={RING_RADIUS} fill="none" strokeWidth="5" />
            <circle
              ref={ringRef}
              className="fill"
              cx="54"
              cy="54"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE}
              style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }}
            />
          </svg>
          <div className="rt">
            <b>{Math.round(REVENUE.goalPct * 100)}%</b>
            of ${(REVENUE.goal / 1000).toFixed(0)}K goal
          </div>
        </div>
      </div>
      <svg className="ins-spark" viewBox="0 0 440 64" preserveAspectRatio="none" aria-hidden="true">
        <path className="ln" d={line} />
      </svg>
    </section>
  );
}
