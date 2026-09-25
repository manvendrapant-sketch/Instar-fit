'use client';

import { useState } from 'react';
import { Icon } from '@/lib/icons';
import { KIND, type QueueEntry } from '@/lib/data';
import { useAppState } from '@/lib/store';

export function QueueItem({ entry, index }: { entry: QueueEntry; index: number }) {
  const { openId, setOpenId, complete, toast } = useAppState();
  const [leaving, setLeaving] = useState(false);
  const kind = KIND[entry.kind];
  const open = openId === entry.id;

  function runAction(actionIndex: number) {
    const action = entry.actions[actionIndex];
    const isPrimary = actionIndex === 0 || action.style === 'go';
    toast(action.toast);
    if (isPrimary) {
      setLeaving(true);
      setTimeout(() => complete(entry.id), 420);
    }
  }

  return (
    <article
      className={`ins-q ${kind.className} ${open ? 'open' : ''} ${leaving ? 'leaving' : ''} ins-in d${Math.min(index + 1, 5)}`}
    >
      <button
        className="ins-q-head"
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : entry.id)}
      >
        <span className="ins-tile" aria-hidden="true" />
        <span className="ins-chip">{kind.label}</span>
        <span className="ins-q-title">
          <b>{entry.title}</b>
          <span>{entry.meta}</span>
        </span>
        <span className="ins-q-value">{entry.value}</span>
        <span className="ins-q-chev">
          <Icon name="chev" />
        </span>
      </button>
      <div className="ins-q-body">
        {entry.facts && (
          <div className="ins-facts">
            {entry.facts.map((f) => (
              <div key={f.label}>
                <b className="ins-num">{f.value}</b>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        )}
        {entry.draft && (
          <div className="ins-draft">
            <span className="ins-label">{entry.who}</span>
            {entry.draft}
          </div>
        )}
        <div className="ins-actions">
          {entry.actions.map((a, i) => (
            <button
              key={a.label}
              className={`ins-btn ${a.style}`}
              onClick={() => runAction(i)}
            >
              {a.label}
              {a.style === 'go' && <Icon name="arrow" />}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
