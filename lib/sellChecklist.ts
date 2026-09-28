import { apiFetch } from './api-client';
import type { CoachPaymentsResponse, OnboardingStatus } from './commerce/types';
import { OFFERS_PATH } from './offers';
import { PAYOUTS_PATH } from './payouts';
import { STOREFRONT_PATH } from './storefront';

// "Get ready to sell" (Sprint 6 onboarding): the checklist on Today that walks a new coach from
// sign-up to their first sale. Every step is read from data the app already loads (profile,
// offers, Connect status, publish state) plus the payments list for the last one. Nothing here is
// stored on the server except what those resources already hold; "shared your link" is a local
// preference, like the other Today dismissals.

export type StepKey = 'storefront' | 'offer' | 'payouts' | 'publish' | 'share' | 'sale';

/**
 * done: finished. next: the one step to do now. todo: can be done, but isn't next.
 * waiting: nothing for the coach to do (Stripe reviewing, no sale yet). locked: needs an earlier step.
 */
export type StepState = 'done' | 'next' | 'todo' | 'waiting' | 'locked';

export type StepAction = { kind: 'link'; label: string; href: string } | { kind: 'copy'; label: string };

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
  linkShared: boolean;
  /** null while unknown (not published yet, or the payments list didn't load). */
  hasSale: boolean | null;
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
        action: { kind: 'link', label: 'See status', href: PAYOUTS_PATH },
      };
    case 'action_needed':
      return {
        ...base,
        done: false,
        body: 'Stripe needs a few more details before it can pay you.',
        action: { kind: 'link', label: 'Finish on Stripe', href: PAYOUTS_PATH },
      };
    default:
      return {
        ...base,
        done: false,
        body: 'Add your bank through Stripe so client payments reach you. About 5 minutes.',
        action: { kind: 'link', label: 'Connect payouts', href: PAYOUTS_PATH },
      };
  }
}

/** Builds the six steps and decides which single one is "next". */
export function buildChecklist(input: ChecklistInput): ChecklistStep[] {
  const drafts: Draft[] = [
    {
      key: 'storefront',
      title: 'Create your storefront',
      done: input.storefrontCompleted,
      body: input.storefrontCompleted ? 'Your page has a name, bio and link.' : 'Your link-in-bio page: name, photo, what you coach.',
      action: input.storefrontCompleted ? null : { kind: 'link', label: 'Create storefront', href: STOREFRONT_PATH },
    },
    {
      key: 'offer',
      title: 'Add an offer',
      done: input.activeOffers > 0,
      body:
        input.activeOffers > 0
          ? `${input.activeOffers} offer${input.activeOffers === 1 ? '' : 's'} on your storefront.`
          : 'Monthly coaching, a program or a single session: what clients can buy.',
      action: input.activeOffers > 0 ? null : { kind: 'link', label: 'Add an offer', href: `${OFFERS_PATH}/new` },
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
      action: input.published || !input.canPublish ? null : { kind: 'link', label: 'Publish', href: STOREFRONT_PATH },
    },
    {
      key: 'share',
      title: 'Share your link',
      // A sale means the link clearly got out, however it was shared.
      done: input.published && (input.linkShared || input.hasSale === true),
      locked: !input.published,
      body: input.published ? 'Put it in your Instagram bio or send it to a client you’re talking to.' : 'Once you’re live.',
      action: input.published ? { kind: 'copy', label: 'Copy link' } : null,
    },
    {
      key: 'sale',
      title: 'Get your first sale',
      done: input.hasSale === true,
      waiting: input.published,
      locked: !input.published,
      body:
        input.hasSale === true
          ? 'Your first client paid. Nice work.'
          : input.published
            ? 'This ticks itself off the moment a client pays.'
            : 'Once you’re live.',
      action: null,
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
    // Only the next step and ones the coach can still act on keep their button; "waiting" keeps a
    // quiet status link where it has one.
    return { ...step, state, action: state === 'done' || state === 'locked' ? null : step.action };
  });
}

export function progress(steps: ChecklistStep[]): { done: number; total: number; complete: boolean } {
  const done = steps.filter((s) => s.state === 'done').length;
  return { done, total: steps.length, complete: done === steps.length };
}

/** The heading: what to do next, in words, or where things stand when nothing's actionable. */
export function headline(steps: ChecklistStep[]): string {
  if (progress(steps).complete) return 'You’re open for business';
  const next = steps.find((s) => s.state === 'next');
  if (next) return `Next: ${next.title.charAt(0).toLowerCase()}${next.title.slice(1)}`;
  if (steps.find((s) => s.key === 'payouts')?.state === 'waiting') return 'Waiting on Stripe';
  return 'Waiting on your first client';
}

/** Whether the coach has any payment that went through. null when it couldn't be checked. */
export async function fetchHasSale(): Promise<boolean | null> {
  const res = await apiFetch<CoachPaymentsResponse>('/api/coach/payments');
  if (!res.success) return null;
  return res.data.payments.some((p) => p.status !== 'failed');
}
