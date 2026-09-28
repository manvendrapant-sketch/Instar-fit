import { apiFetch } from './api-client';
import type { CoachingMode, CoachProfile, StorefrontStatus, UpdateCoachProfileRequest } from './commerce/types';

// Storefront creation. The draft is exactly the real API's CoachProfile (GET/PATCH
// /api/coach/profile) — offers come from the offer builder instead, so this file's own concern
// is the profile fields plus handle-format checks the API itself also enforces.
export type { CoachingMode };
export type StorefrontDraft = CoachProfile;
export type StorefrontField = 'handle' | 'displayName' | 'bio' | 'avatar' | 'specialties' | 'location' | 'timeZone';

export const STOREFRONT_PATH = '/business/storefront';
export const BIO_MAX = 160;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const SPECIALTIES_MAX = 3;
export const SPECIALTY_MAX_LEN = 24;
export const LOCATION_MAX = 60;

export const SPECIALTIES = [
  'Strength',
  'Weight loss',
  'Muscle gain',
  'Running',
  'Endurance',
  'HIIT',
  'Mobility',
  'Yoga',
  'Pilates',
  'Nutrition',
  'Pre & postnatal',
  'Sports performance',
  'Injury rehab',
  'Over 50s',
  'Mindset',
] as const;

export const COACHING_MODES: Record<CoachingMode, string> = {
  online: 'Online',
  in_person: 'In person',
  both: 'Online and in person',
};

export const DEFAULT_TIME_ZONE = 'America/New_York';

/** The browser's zone, or a default if the runtime can't say. */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "America/Chicago (GMT-5)". The offset is today's, so it follows daylight saving. */
export function timeZoneLabel(tz: string, at: Date = new Date()): string {
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  return `${tz.replace(/_/g, ' ')}${offset ? ` (${offset})` : ''}`;
}

/** Adds a specialty unless it's blank, a duplicate (any case) or the list is full. */
export function addSpecialty(list: string[], raw: string): string[] {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s || list.length >= SPECIALTIES_MAX || list.some((x) => x.toLowerCase() === s.toLowerCase())) return list;
  return [...list, s];
}

/** "Austin, TX · Online", "Online and in person". */
export function locationLine(d: Pick<StorefrontDraft, 'location' | 'coachingMode'>): string {
  return [d.location?.trim(), COACHING_MODES[d.coachingMode]].filter(Boolean).join(' · ');
}

/**
 * Builds a full draft from partial info — the storefront creator starts from just the
 * handle/displayName the session's JWT already carries, before GET /api/coach/profile's real
 * answer comes back.
 */
export function withStorefrontDefaults(d: Partial<StorefrontDraft> & Pick<StorefrontDraft, 'handle' | 'displayName'>): StorefrontDraft {
  return {
    bio: null,
    avatarUrl: null,
    location: null,
    coachingMode: 'online',
    timeZone: detectTimeZone(),
    completed: false,
    setupChecklistClosedAt: null,
    ...d,
    specialties: d.specialties ?? [],
  };
}

const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

// Words that would collide with an app route once the public storefront lives at /<handle> —
// permanently reserved, not a stand-in for a real check. lib/commerce/profile.ts validates the
// same list server-side; keep the two in sync. Whether a *specific* handle belongs to another
// coach can only be known by the server — PATCH /api/coach/profile is the actual source of truth
// for that and reports it as a 409 the same way signup reports a taken email.
const TAKEN_HANDLES = new Set(['instar', 'admin', 'api', 'app', 'help', 'support', 'login', 'signup', 'business', 'clients', 'grow']);

/** How a storefront link is written in the UI. The page itself lives at /<handle> (the workplan's /[coachHandle]). */
export function storefrontLink(handle: string) {
  return `instar.co/${handle || 'yourname'}`;
}

export function normalizeHandle(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export type HandleStatus = 'empty' | 'invalid' | 'taken' | 'available';

export function handleStatus(handle: string): HandleStatus {
  if (!handle) return 'empty';
  if (!HANDLE.test(handle)) return 'invalid';
  return TAKEN_HANDLES.has(handle) ? 'taken' : 'available';
}

// --- Backend calls -----------------------------------------------------------------------

export function toUpdateProfileRequest(d: StorefrontDraft): UpdateCoachProfileRequest {
  return {
    handle: d.handle,
    displayName: d.displayName,
    bio: d.bio,
    avatarUrl: d.avatarUrl,
    specialties: d.specialties,
    location: d.location,
    coachingMode: d.coachingMode,
    timeZone: d.timeZone,
  };
}

// The backend's field keys line up 1:1 with StorefrontField except "avatar" (no server-side
// format check on avatarUrl exists to fail).
function mapProfileFields(fields?: Record<string, string>): Partial<Record<StorefrontField, string>> {
  if (!fields) return {};
  const errors: Partial<Record<StorefrontField, string>> = {};
  for (const key of ['handle', 'displayName', 'bio', 'specialties', 'location', 'timeZone'] as const) {
    if (fields[key]) errors[key] = fields[key];
  }
  return errors;
}

export async function fetchProfile(): Promise<{ ok: true; profile: CoachProfile } | { ok: false; message: string }> {
  const result = await apiFetch<CoachProfile>('/api/coach/profile');
  if (result.success) return { ok: true, profile: result.data };
  return { ok: false, message: result.message };
}

export async function saveProfile(
  input: UpdateCoachProfileRequest,
): Promise<{ ok: true; profile: CoachProfile } | { ok: false; message: string; fieldErrors: Partial<Record<StorefrontField, string>> }> {
  const result = await apiFetch<CoachProfile>('/api/coach/profile', { method: 'PATCH', body: input });
  if (result.success) return { ok: true, profile: result.data };
  return { ok: false, message: result.message, fieldErrors: mapProfileFields(result.fields) };
}

export async function setStorefrontPublished(
  published: boolean,
): Promise<{ ok: true; status: StorefrontStatus } | { ok: false; message: string }> {
  const result = await apiFetch<StorefrontStatus>('/api/storefront', { method: 'PATCH', body: { published } });
  if (result.success) return { ok: true, status: result.data };
  return { ok: false, message: result.message };
}

export function validateStorefront(d: StorefrontDraft): Partial<Record<StorefrontField, string>> {
  const errors: Partial<Record<StorefrontField, string>> = {};
  const status = handleStatus(d.handle);
  if (status === 'empty' || status === 'invalid') errors.handle = 'Use 3–30 lowercase letters, numbers or hyphens.';
  else if (status === 'taken') errors.handle = `${storefrontLink(d.handle)} is taken. Try another.`;
  if (!d.displayName.trim()) errors.displayName = 'Add the name clients will see.';
  if ((d.bio ?? '').length > BIO_MAX) errors.bio = `Keep it under ${BIO_MAX} characters.`;
  if (d.specialties.length === 0) errors.specialties = 'Pick at least one, so clients know who you coach.';
  else if (d.specialties.length > SPECIALTIES_MAX) errors.specialties = `Pick up to ${SPECIALTIES_MAX}.`;
  else if (d.specialties.some((s) => s.length > SPECIALTY_MAX_LEN)) errors.specialties = `Keep each under ${SPECIALTY_MAX_LEN} characters.`;
  if ((d.location ?? '').length > LOCATION_MAX) errors.location = `Keep it under ${LOCATION_MAX} characters.`;
  if (!isTimeZone(d.timeZone)) errors.timeZone = 'Choose your time zone.';
  return errors;
}
