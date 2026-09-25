'use client';

import { useState } from 'react';
import { Icon } from '@/lib/icons';
import type { SpaceDef } from '@/lib/data';
import { useAppState } from '@/lib/store';

export function SpaceTiles({ space }: { space: SpaceDef }) {
  const { toast } = useAppState();
  const [flashed, setFlashed] = useState<string | null>(null);

  function open(tileId: string, title: string) {
    setFlashed(tileId);
    toast(`${title} gets its full redesign in the next round`);
    setTimeout(() => setFlashed(null), 1400);
  }

  return (
    <>
      <section className="ins-space-hero">
        <div>
          <div className="ins-label ins-in" style={{ marginBottom: 18 }}>
            {space.tiles.length} areas
          </div>
          <h1 className="ins-in d1">{space.title}</h1>
          <p className="ins-in d2">{space.lede}</p>
        </div>
        <button className="ins-btn ins-in d2">
          <Icon name="search" />
          Find anything in {space.title}
        </button>
      </section>
      <div className="ins-tiles">
        {space.tiles.map((tile, i) => (
          <button
            key={tile.id}
            id={tile.id}
            className={`ins-panel ins-tile-card ${tile.lead ? 'lead' : ''} ${flashed === tile.id ? 'flash' : ''} ins-in d${Math.min(i + 1, 5)}`}
            onClick={() => open(tile.id, tile.title)}
          >
            <div className="top">
              <span className="ins-label">{String(i + 1).padStart(2, '0')}</span>
              <Icon name="arrow" />
            </div>
            <h3>{tile.title}</h3>
            <p>{tile.description}</p>
            {tile.statValue && (
              <div className="stat">
                <b className="ins-num">{tile.statValue}</b>
                <span>{tile.statLabel}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
