'use client';

import { useEffect, useRef, useState } from 'react';
import { REVENUE } from '@/lib/data';

function sparkPaths() {
  const v = REVENUE.sparkline;
  const W = 400;
  const H = 64;
  const mn = 4;
  const mx = 9;
  const pts = v.map((y, i) => [(i * W) / (v.length - 1), H - 4 - ((y - mn) / (mx - mn)) * (H - 10)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return { line, area: `${line} L${W} ${H} L0 ${H} Z` };
}

export function RevenueCard() {
  const [display, setDisplay] = useState(0);
  const ringRef = useRef<SVGCircleElement>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion.current) {
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
    const c = 2 * Math.PI * 46;
    if (ringRef.current) {
      requestAnimationFrame(() => {
        if (ringRef.current) ringRef.current.style.strokeDashoffset = String(c * (1 - REVENUE.goalPct));
      });
    }
  }, []);

  const { line, area } = sparkPaths();
  const c = 2 * Math.PI * 46;

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
        <div className="ins-ring" role="img" aria-label={`${Math.round(REVENUE.goalPct * 100)}% of the $${REVENUE.goal.toLocaleString()} monthly goal`}>
          <svg viewBox="0 0 108 108">
            <circle className="track" cx="54" cy="54" r="46" fill="none" strokeWidth="6" />
            <circle
              ref={ringRef}
              className="fill"
              cx="54"
              cy="54"
              r="46"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c}
              style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }}
            />
          </svg>
          <div className="rt">
            <b>{Math.round(REVENUE.goalPct * 100)}%</b>
            of ${(REVENUE.goal / 1000).toFixed(0)}K goal
          </div>
        </div>
      </div>
      <svg className="ins-spark" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="spark-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-gradient)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  );
}
