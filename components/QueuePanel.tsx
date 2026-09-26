'use client';

import { QUEUE } from '@/lib/data';
import { useAppState } from '@/lib/store';
import { QueueItem } from './QueueItem';

export function QueuePanel() {
  const { done, reset } = useAppState();
  const left = QUEUE.filter((q) => !done.includes(q.id));

  return (
    <section className="ins-panel" aria-labelledby="queue-heading">
      <div className="ins-panel-h">
        <h2 id="queue-heading">Your queue</h2>
        <div className="ins-progress">
          <span className="ins-num">
            {done.length} of {QUEUE.length} done
          </span>
          <span className="track">
            <i style={{ width: `${(done.length / QUEUE.length) * 100}%` }} />
          </span>
        </div>
      </div>
      <div className="ins-queue-list">
        {left.length === 0 ? (
          <div className="ins-clear">
            <span className="ins-label">Queue clear</span>
            <b>You&apos;re clear for today.</b>
            <span className="ins-num" style={{ color: 'var(--muted)', fontWeight: 400 }}>
              Everything that needed you is handled.
            </span>
            <div style={{ marginTop: 10 }}>
              <button className="ins-btn" onClick={reset}>
                Replay the queue
              </button>
            </div>
          </div>
        ) : (
          left.map((entry, i) => <QueueItem key={entry.id} entry={entry} index={i} />)
        )}
      </div>
    </section>
  );
}
