import { apiFetch } from './api-client';
import type { OnboardingStatus, SetupChecklistCloseResponse } from './commerce/types';
import { OFFERS_PATH } from './offers';
import { PAYOUTS_PATH } from './payouts';
import { STOREFRONT_PATH } from './storefront';

// "Get ready to sell" (Sprint 6 onboarding): the checklist on Today that walks a new coach from
// sign-up to a live storefront. Four steps, read from data the app already loads (profile, offers,
// Connect status, publish state). Once all four are done it closes itself, for good: the close is
// saved on the coach (POST /api/coach/setup-checklist/close), so it never comes back on any device.

export type StepKey = 'storefront' | 'offer' | 'payouts' | 'publish';

/**
 * done: finished. next: the one step to do now. todo: can be done, but isn't next.
 * waiting: nothing for the coach to do (Stripe reviewing). locked: needs an earlier step.
 */
export type StepState = 'done' | 'next' | 'todo' | 'waiting' | 'locked';

export interface StepAction {
  label: string;
  href: string;
}

export interface ChecklistStep {
  key: StepKey;
  title: string;
  body: string;
  state: StepState;
  action: StepAction | null;
}

export interface ChecklistInput {
  storefrontCompleted: boolean;
  /** Offers shown on the storefront (`active`), not every offer the coach has drafted. */
  activeOffers: number;
  payouts: OnboardingStatus;
  published: boolean;
  /** The server's own publish gate (GET /api/storefront), never recomputed here. */
  canPublish: boolean;
}

type Draft = Omit<ChecklistStep, 'state'> & { done: boolean; waiting?: boolean; locked?: boolean };

function payoutsStep(p: OnboardingStatus): Draft {
  const base = { key: 'payouts' as const, title: 'Connect payouts' };
  switch (p.status) {
    case 'ready':
      return { ...base, done: true, body: 'Stripe pays client money straight into your bank.', action: null };
    case 'pending_review':
      return {
        ...base,
        done: false,
        waiting: true,
        body: 'Stripe is checking your details. This usually takes a day or two; nothing to do meanwhile.',
        action: { label: 'See status', href: PAYOUTS_PATH },
      };
    case 'action_needed':
      return {
        ...base,
        done: false,
        body: 'Stripe needs a few more details before it can pay you.',
        action: { label: 'Finish on Stripe', href: PAYOUTS_PATH },
      };
    default:
      return {
        ...base,
        done: false,
        body: 'Add your bank through Stripe so client payments reach you. About 5 minutes.',
        action: { label: 'Connect payouts', href: PAYOUTS_PATH },
      };
  }
}

/** Builds the four steps and decides which single one is "next". */
export function buildChecklist(input: ChecklistInput): ChecklistStep[] {
  const drafts: Draft[] = [
    {
      key: 'storefront',
      title: 'Create your storefront',
      done: input.storefrontCompleted,
      body: input.storefrontCompleted ? 'Your page has a name, bio and link.' : 'Your link-in-bio page: name, photo, what you coach.',
      action: input.storefrontCompleted ? null : { label: 'Create storefront', href: STOREFRONT_PATH },
    },
    {
      key: 'offer',
      title: 'Add an offer',
      done: input.activeOffers > 0,
      body:
        input.activeOffers > 0
          ? `${input.activeOffers} offer${input.activeOffers === 1 ? '' : 's'} on your storefront.`
          : 'Monthly coaching, a program or a single session: what clients can buy.',
      action: input.activeOffers > 0 ? null : { label: 'Add an offer', href: `${OFFERS_PATH}/new` },
    },
    payoutsStep(input.payouts),
    {
      key: 'publish',
      title: 'Publish your storefront',
      done: input.published,
      locked: !input.published && !input.canPublish,
      body: input.published
        ? 'Your page is live for anyone with the link.'
        : input.canPublish
          ? 'Everything’s in place. Make your page public.'
          : 'Unlocks once you have an offer and payouts are connected.',
      action: input.published || !input.canPublish ? null : { label: 'Publish', href: STOREFRONT_PATH },
    },
  ];

  let nextTaken = false;
  return drafts.map(({ done, waiting, locked, ...step }) => {
    let state: StepState;
    if (done) state = 'done';
    else if (locked) state = 'locked';
    else if (waiting) state = 'waiting';
    else if (!nextTaken) {
      state = 'next';
      nextTaken = true;
    } else state = 'todo';
    return { ...step, state, action: state === 'done' || state === 'locked' ? null : step.action };
  });
}

export function progress(steps: ChecklistStep[]): { done: number; total: number; complete: boolean } {
  const done = steps.filter((s) => s.state === 'done').length;
  return { done, total: steps.length, complete: done === steps.length };
}

/** The heading: what to do next, in words, or what it's waiting on when nothing's actionable. */
export function headline(steps: ChecklistStep[]): string {
  const next = steps.find((s) => s.state === 'next');
  if (next) return `Next: ${next.title.charAt(0).toLowerCase()}${next.title.slice(1)}`;
  if (steps.find((s) => s.key === 'payouts')?.state === 'waiting') return 'Waiting on Stripe';
  return 'You’re live';
}

/** Saves "checklist closed" on the coach, for good. Returns the close time, or null if it failed. */
export async function closeSetupChecklist(): Promise<string | null> {
  const res = await apiFetch<SetupChecklistCloseResponse>('/api/coach/setup-checklist/close', { method: 'POST' });
  return res.success ? res.data.setupChecklistClosedAt : null;
}
