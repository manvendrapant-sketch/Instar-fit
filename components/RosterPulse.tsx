'use client';

import { ROSTER, type RosterState } from '@/lib/data';
import { useAppState } from '@/lib/store';

const STATE_LABEL: Record<RosterState, string> = {
  ok: 'on track',
  warn: 'drifting this week',
  bad: 'off track. Worth a message.',
};

export function RosterPulse() {
  const { toast } = useAppState();
  const counts = {
    ok: ROSTER.filter((r) => r.state === 'ok').length,
    warn: ROSTER.filter((r) => r.state === 'warn').length,
    bad: ROSTER.filter((r) => r.state === 'bad').length,
  };

  return (
    <section className="ins-panel" aria-labelledby="pulse-heading">
      <div className="ins-panel-h">
        <h2 id="pulse-heading">Roster pulse</h2>
        <span className="ins-label">Last 7 days</span>
      </div>
      <div style={{ padding: '0 26px 24px' }}>
        <div className="ins-dots">
          {ROSTER.map((r) => (
            <button
              key={r.name}
              className={r.state}
              aria-label={`${r.name}, ${r.state === 'ok' ? 'on track' : r.state === 'warn' ? 'drifting' : 'off track'}`}
              title={r.name}
              onClick={() => toast(`${r.name} is ${STATE_LABEL[r.state]}`)}
            />
          ))}
        </div>
        <div className="ins-legend">
          <span>
            <i style={{ background: 'var(--ok)' }} />
            <b>{counts.ok}</b> on track
          </span>
          <span>
            <i style={{ background: 'var(--warn)' }} />
            <b>{counts.warn}</b> drifting
          </span>
          <span>
            <i style={{ background: 'var(--bad)' }} />
            <b>{counts.bad}</b> off track
          </span>
        </div>
      </div>
    </section>
  );
}
