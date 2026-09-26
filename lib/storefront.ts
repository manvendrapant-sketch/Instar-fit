import type { CoachPublicProfile } from './commerce/types';

// Storefront creation, frontend only. The draft is the part of the public profile a coach fills
// in at creation, plus specialties, location and time zone, which the contract
// (lib/commerce/types.ts CoachPublicProfile) doesn't carry yet: flag to Manvendra before wiring
// the real API. Offers come from the offer builder. Nothing here calls a server.

export type CoachingMode = 'online' | 'in_person' | 'both';

export interface StorefrontDraft extends Pick<CoachPublicProfile, 'handle' | 'displayName' | 'bio' | 'avatarUrl'> {
  /** 1 to SPECIALTIES_MAX, shown as tags under the coach's name. */
  specialties: string[];
  /** Free text, e.g. "Austin, TX". Optional. */
  location: string | null;
  coachingMode: CoachingMode;
  /** IANA zone, e.g. "America/Chicago". Used for session and check-in times, not shown on the profile. */
  timeZone: string;
}
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
 * Storefronts saved before specialties/location/time zone existed are missing those fields;
 * fill them so older saved drafts still load.
 */
export function withStorefrontDefaults(d: Partial<StorefrontDraft> & Pick<StorefrontDraft, 'handle' | 'displayName'>): StorefrontDraft {
  return {
    bio: null,
    avatarUrl: null,
    location: null,
    coachingMode: 'online',
    timeZone: detectTimeZone(),
    ...d,
    specialties: d.specialties ?? [],
  };
}

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
  if (d.specialties.length === 0) errors.specialties = 'Pick at least one, so clients know who you coach.';
  else if (d.specialties.length > SPECIALTIES_MAX) errors.specialties = `Pick up to ${SPECIALTIES_MAX}.`;
  else if (d.specialties.some((s) => s.length > SPECIALTY_MAX_LEN)) errors.specialties = `Keep each under ${SPECIALTY_MAX_LEN} characters.`;
  if ((d.location ?? '').length > LOCATION_MAX) errors.location = `Keep it under ${LOCATION_MAX} characters.`;
  if (!isTimeZone(d.timeZone)) errors.timeZone = 'Choose your time zone.';
  return errors;
}
