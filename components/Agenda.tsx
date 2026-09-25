'use client';

import Link from 'next/link';
import { AGENDA } from '@/lib/data';
import { useAppState } from '@/lib/store';

export function Agenda() {
  const { toast } = useAppState();

  return (
    <section className="ins-panel" aria-labelledby="agenda-heading">
      <div className="ins-panel-h">
        <h2 id="agenda-heading">Coming up</h2>
        <span className="ins-label">This week</span>
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        {AGENDA.map((slot) => (
          <div className="ins-slot" key={slot.title}>
            <span className="t">{slot.time}</span>
            <div>
              <b>{slot.title}</b>
              <span>{slot.meta}</span>
            </div>
            {slot.href ? (
              <Link href={slot.href} className="ins-btn quiet">
                {slot.action}
              </Link>
            ) : (
              <button className="ins-btn quiet" onClick={() => toast(slot.toast ?? '')}>
                {slot.action}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
