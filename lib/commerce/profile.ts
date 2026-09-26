import 'server-only';
import type { CoachingMode } from './types';

// Mirrors the storefront creator's own limits (lib/storefront.ts, frontend) — keep the two in sync.
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
// Words that would collide with an app route once the public storefront lives at /<handle>.
// lib/storefront.ts (frontend) checks the same list for instant feedback; keep both in sync.
const RESERVED_HANDLES = new Set(['instar', 'admin', 'api', 'app', 'help', 'support', 'login', 'signup', 'business', 'clients', 'grow']);
const COACHING_MODES: CoachingMode[] = ['online', 'in_person', 'both'];
const BIO_MAX = 160;
const SPECIALTIES_MAX = 3;
const SPECIALTY_MAX_LEN = 24;
const LOCATION_MAX = 60;

export interface ProfileInput {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  specialties: string[];
  location: string | null;
  coachingMode: CoachingMode;
  timeZone: string;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Full validation for PATCH /api/coach/profile — the storefront creator always submits the whole
 * draft, so unlike offers there's no partial-update variant. Handle *uniqueness* isn't checked
 * here (it needs a DB round trip); the route does that separately and reports a taken handle the
 * same way signup does (a 409 with a `fields.handle` message).
 */
export function validateProfileInput(body: unknown): { errors: Record<string, string> } | { value: ProfileInput } {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const handle = typeof b.handle === 'string' ? b.handle.trim().toLowerCase() : '';
  if (!handle || !HANDLE_RE.test(handle)) errors.handle = 'Use 3–30 lowercase letters, numbers or hyphens.';
  else if (RESERVED_HANDLES.has(handle)) errors.handle = `${handle}.instar.co is taken. Try another.`;

  const displayName = typeof b.displayName === 'string' ? b.displayName.trim() : '';
  if (!displayName) errors.displayName = 'Add the name clients will see.';

  const bio = typeof b.bio === 'string' && b.bio.trim() ? b.bio.trim() : null;
  if (bio && bio.length > BIO_MAX) errors.bio = `Keep it under ${BIO_MAX} characters.`;

  const avatarUrl = typeof b.avatarUrl === 'string' && b.avatarUrl ? b.avatarUrl : null;

  const specialtiesRaw = Array.isArray(b.specialties) ? b.specialties.filter((s) => typeof s === 'string') : [];
  const specialties = specialtiesRaw.map((s) => s.trim()).filter(Boolean);
  if (specialties.length === 0) errors.specialties = 'Pick at least one, so clients know who you coach.';
  else if (specialties.length > SPECIALTIES_MAX) errors.specialties = `Pick up to ${SPECIALTIES_MAX}.`;
  else if (specialties.some((s) => s.length > SPECIALTY_MAX_LEN)) errors.specialties = `Keep each under ${SPECIALTY_MAX_LEN} characters.`;

  const location = typeof b.location === 'string' && b.location.trim() ? b.location.trim() : null;
  if (location && location.length > LOCATION_MAX) errors.location = `Keep it under ${LOCATION_MAX} characters.`;

  const coachingMode = COACHING_MODES.includes(b.coachingMode as CoachingMode) ? (b.coachingMode as CoachingMode) : 'online';

  const timeZone = typeof b.timeZone === 'string' ? b.timeZone : '';
  if (!timeZone || !isValidTimeZone(timeZone)) errors.timeZone = 'Choose your time zone.';

  if (Object.keys(errors).length > 0) return { errors };
  return { value: { handle, displayName, bio, avatarUrl, specialties, location, coachingMode, timeZone } };
}
