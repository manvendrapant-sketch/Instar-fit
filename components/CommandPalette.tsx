'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/lib/icons';
import { COMMANDS } from '@/lib/data';
import { useAppState } from '@/lib/store';

export function CommandPalette() {
  const { cmdOpen, setCmdOpen, toast } = useAppState();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMANDS.filter((c) => !q || c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)).slice(0, 14);
  }, [query]);

  useEffect(() => {
    if (cmdOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [cmdOpen]);

  function updateQuery(value: string) {
    setQuery(value);
    setSel(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(!cmdOpen);
        return;
      }
      if (!cmdOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setCmdOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => (items.length ? (s + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (items.length ? (s - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        run(sel);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmdOpen, items, sel]);

  function run(i: number) {
    const c = items[i];
    if (!c) return;
    setCmdOpen(false);
    if (c.href) router.push(c.href);
    if (c.toast) toast(c.toast);
  }

  if (!cmdOpen) return null;

  let lastGroup = '';

  return (
    <div className="ins-cmdk" role="dialog" aria-modal="true" aria-label="Search or ask" onClick={() => setCmdOpen(false)}>
      <div className="ins-cmdk-box" onClick={(e) => e.stopPropagation()}>
        <div className="ins-cmdk-in">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Jump to a page, find a client, or type an action"
            aria-label="Search or ask"
            autoComplete="off"
          />
        </div>
        <div className="ins-cmdk-list" role="listbox">
          {items.length === 0 && (
            <div className="ins-cmdk-empty">Nothing matches &quot;{query}&quot;. Try a client&apos;s name or a page.</div>
          )}
          {items.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <div key={`${c.group}-${c.label}`}>
                {showGroup && <div className="ins-cmdk-g ins-label">{c.group}</div>}
                <button
                  className={`ins-cmdk-it ${i === sel ? 'sel' : ''}`}
                  role="option"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => run(i)}
                >
                  <Icon name={c.group === 'Clients' ? 'user' : c.group === 'Actions' ? 'bolt' : 'grid'} />
                  {c.label}
                  <span className="h">{c.hint}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="ins-cmdk-foot">
          <span>{'↑↓ Move'}</span>
          <span>{'↵ Open'}</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
