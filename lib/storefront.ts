import type { CoachPublicProfile } from './commerce/types';

// Storefront creation, frontend only. The draft is the subset of the public profile a coach
// fills in at creation; offers come later from the offer builder. Nothing here calls a server.

export type StorefrontDraft = Pick<CoachPublicProfile, 'handle' | 'displayName' | 'bio' | 'avatarUrl'>;
export type StorefrontField = 'handle' | 'displayName' | 'bio' | 'avatar';

export const STOREFRONT_PATH = '/business/storefront';
export const BIO_MAX = 160;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

// Mock availability until a handle-check endpoint exists. These would clash with app routes
// or are already taken in the seed data.
const TAKEN_HANDLES = new Set(['instar', 'admin', 'api', 'app', 'help', 'support', 'login', 'signup', 'business', 'clients', 'grow']);

export function normalizeHandle(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export type HandleStatus = 'empty' | 'invalid' | 'taken' | 'available';

export function handleStatus(handle: string): HandleStatus {
  if (!handle) return 'empty';
  if (!HANDLE.test(handle)) return 'invalid';
  return TAKEN_HANDLES.has(handle) ? 'taken' : 'available';
}

export function validateStorefront(d: StorefrontDraft): Partial<Record<StorefrontField, string>> {
  const errors: Partial<Record<StorefrontField, string>> = {};
  const status = handleStatus(d.handle);
  if (status === 'empty' || status === 'invalid') errors.handle = 'Use 3–30 lowercase letters, numbers or hyphens.';
  else if (status === 'taken') errors.handle = `${d.handle}.instar.co is taken. Try another.`;
  if (!d.displayName.trim()) errors.displayName = 'Add the name clients will see.';
  if ((d.bio ?? '').length > BIO_MAX) errors.bio = `Keep it under ${BIO_MAX} characters.`;
  return errors;
}
