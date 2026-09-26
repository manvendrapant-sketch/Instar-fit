'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QUEUE } from './data';
import type { StorefrontDraft } from './storefront';

type Theme = 'dark' | 'light';

interface AppState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  done: string[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  /** Called by a queue row once its leave animation has finished. */
  complete: (id: string) => void;
  reset: () => void;
  toastMessage: string | null;
  toast: (message: string) => void;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
  cmdOpen: boolean;
  setCmdOpen: (v: boolean) => void;
  /** The coach's storefront, or null until they create one. Frontend only: kept in this browser. */
  storefront: StorefrontDraft | null;
  saveStorefront: (s: StorefrontDraft) => void;
  /** The "create your storefront" popup on Today was closed with "Later". */
  storefrontPromptDismissed: boolean;
  dismissStorefrontPrompt: () => void;
}

const AppContext = createContext<AppState | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [done, setDone] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(QUEUE[0]?.id ?? null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [storefront, setStorefront] = useState<StorefrontDraft | null>(null);
  const [storefrontPromptDismissed, setStorefrontPromptDismissed] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage after mount (avoids SSR/client mismatch).
  useEffect(() => {
    const savedDone = readStorage<string[]>('ins_done', []);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readStorage<Theme>('ins_theme', 'dark'));
    setDone(savedDone);
    setStorefront(readStorage<StorefrontDraft | null>('ins_storefront', null));
    setStorefrontPromptDismissed(readStorage<boolean>('ins_storefront_prompt_dismissed', false));
    const firstOpen = QUEUE.find((q) => !savedDone.includes(q.id));
    setOpenId(firstOpen ? firstOpen.id : null);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeStorage('ins_theme', theme);
  }, [theme]);

  useEffect(() => {
    writeStorage('ins_done', done);
    // If the open row just got marked done, advance to the next open one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId((current) => {
      if (current && !done.includes(current)) return current;
      const next = QUEUE.find((q) => !done.includes(q.id));
      return next ? next.id : null;
    });
  }, [done]);

  useEffect(() => {
    document.body.classList.toggle('ins-nav-open', navOpen);
  }, [navOpen]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  const complete = useCallback((id: string) => {
    setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const reset = useCallback(() => {
    setDone([]);
  }, []);

  const saveStorefront = useCallback((s: StorefrontDraft) => {
    setStorefront(s);
    writeStorage('ins_storefront', s);
  }, []);

  const dismissStorefrontPrompt = useCallback(() => {
    setStorefrontPromptDismissed(true);
    writeStorage('ins_storefront_prompt_dismissed', true);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      done,
      openId,
      setOpenId,
      complete,
      reset,
      toastMessage,
      toast,
      navOpen,
      setNavOpen,
      cmdOpen,
      setCmdOpen,
      storefront,
      saveStorefront,
      storefrontPromptDismissed,
      dismissStorefrontPrompt,
    }),
    [
      theme,
      setTheme,
      done,
      openId,
      complete,
      reset,
      toastMessage,
      toast,
      navOpen,
      cmdOpen,
      storefront,
      saveStorefront,
      storefrontPromptDismissed,
      dismissStorefrontPrompt,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
