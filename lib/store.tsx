'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QUEUE } from './data';
import { fetchProfile } from './storefront';
import { fetchOffers } from './offers';
import { fetchOnboardingStatus } from './payouts';
import type { CoachOfferSummary, CoachProfile, OnboardingStatus, StorefrontStatus } from './commerce/types';
import { apiFetch } from './api-client';

type Theme = 'dark' | 'light';

const NOT_STARTED: OnboardingStatus = { status: 'not_started', chargesEnabled: false, payoutsEnabled: false, requirementsDue: [] };

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
  /** The coach's storefront profile, from GET /api/coach/profile. Null only until the first load settles. */
  storefront: CoachProfile | null;
  /** Re-fetches the profile — call after a successful PATCH /api/coach/profile. */
  refreshStorefront: () => Promise<void>;
  /** Publish state, from GET /api/storefront. Null only until the first load settles. */
  storefrontStatus: StorefrontStatus | null;
  /** Re-fetches publish state — call after publishing/unpublishing, or after offers/payouts change. */
  refreshStorefrontStatus: () => Promise<void>;
  /** The "create your storefront" popup on Today was closed with "Later". Still a local-only preference. */
  storefrontPromptDismissed: boolean;
  dismissStorefrontPrompt: () => void;
  /** The coach's offers, from GET /api/offers, in storefront order. */
  offers: CoachOfferSummary[];
  /** Re-fetches the list — call after a successful create/update/delete/reorder. */
  refreshOffers: () => Promise<void>;
  /** Stripe Connect onboarding status, from GET /api/coach/onboarding-status. */
  payouts: OnboardingStatus;
  /** Re-fetches status — call after returning from Stripe, or on the payouts page mounting. */
  refreshPayouts: () => Promise<void>;
  /** True once every local preference and the first round of server fetches above have settled. */
  hydrated: boolean;
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

/**
 * `signedIn` comes from the root layout (is there a session cookie at all). Signed-out pages —
 * log in, sign up, a coach's public storefront — skip the coach-only fetches below, which would
 * otherwise 401 and toast an error at someone who isn't a coach.
 */
export function AppStateProvider({ children, signedIn = true }: { children: React.ReactNode; signedIn?: boolean }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [done, setDone] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(QUEUE[0]?.id ?? null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [storefront, setStorefront] = useState<CoachProfile | null>(null);
  const [storefrontStatus, setStorefrontStatus] = useState<StorefrontStatus | null>(null);
  const [storefrontPromptDismissed, setStorefrontPromptDismissed] = useState(false);
  const [offers, setOffers] = useState<CoachOfferSummary[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [payouts, setPayouts] = useState<OnboardingStatus>(NOT_STARTED);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  const refreshOffers = useCallback(async () => {
    const result = await fetchOffers();
    if (result.ok) setOffers(result.offers);
    else toast(result.message);
  }, [toast]);

  const refreshPayouts = useCallback(async () => {
    const result = await fetchOnboardingStatus();
    if (result.ok) setPayouts(result.status);
    else toast(result.message);
  }, [toast]);

  const refreshStorefront = useCallback(async () => {
    const result = await fetchProfile();
    if (result.ok) setStorefront(result.profile);
    else toast(result.message);
  }, [toast]);

  const refreshStorefrontStatus = useCallback(async () => {
    const result = await apiFetch<StorefrontStatus>('/api/storefront');
    if (result.success) setStorefrontStatus(result.data);
    else toast(result.message);
  }, [toast]);

  // Read local-only preferences, then load every server-backed resource in parallel. Both halves
  // must settle before `hydrated` flips, so a page can't render an empty/default state as if it
  // were the coach's real (still-loading) one.
  useEffect(() => {
    const savedDone = readStorage<string[]>('ins_done', []);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readStorage<Theme>('ins_theme', 'dark'));
    setDone(savedDone);
    setStorefrontPromptDismissed(readStorage<boolean>('ins_storefront_prompt_dismissed', false));
    const firstOpen = QUEUE.find((q) => !savedDone.includes(q.id));
    setOpenId(firstOpen ? firstOpen.id : null);

    if (!signedIn) {
      setHydrated(true);
      return;
    }
    Promise.all([refreshOffers(), refreshPayouts(), refreshStorefront(), refreshStorefrontStatus()]).finally(() => {
      setHydrated(true);
    });
    // Deliberately once on mount — the refresh* functions are stable (useCallback) and re-fetching
    // on their identity changing would just repeat this same initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const complete = useCallback((id: string) => {
    setDone((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const reset = useCallback(() => {
    setDone([]);
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
      refreshStorefront,
      storefrontStatus,
      refreshStorefrontStatus,
      storefrontPromptDismissed,
      dismissStorefrontPrompt,
      offers,
      refreshOffers,
      payouts,
      refreshPayouts,
      hydrated,
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
      refreshStorefront,
      storefrontStatus,
      refreshStorefrontStatus,
      storefrontPromptDismissed,
      dismissStorefrontPrompt,
      offers,
      refreshOffers,
      payouts,
      refreshPayouts,
      hydrated,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
