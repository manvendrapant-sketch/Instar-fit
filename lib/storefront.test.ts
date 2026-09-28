import {
  addSpecialty,
  BIO_MAX,
  fetchProfile,
  handleStatus,
  isTimeZone,
  locationLine,
  normalizeHandle,
  saveProfile,
  setStorefrontPublished,
  SPECIALTIES_MAX,
  timeZoneLabel,
  toUpdateProfileRequest,
  validateStorefront,
  withStorefrontDefaults,
  type StorefrontDraft,
} from './storefront';

const valid: StorefrontDraft = {
  handle: 'maya-reyes',
  displayName: 'Maya Reyes',
  bio: null,
  avatarUrl: null,
  specialties: ['Strength'],
  location: null,
  coachingMode: 'online',
  timeZone: 'America/Chicago',
  completed: true,
  setupChecklistClosedAt: null,
};

describe('normalizeHandle', () => {
  it('lowercases, trims and turns spaces into hyphens', () => {
    expect(normalizeHandle('  Maya Reyes ')).toBe('maya-reyes');
    expect(normalizeHandle('MAYA')).toBe('maya');
  });
});

describe('handleStatus', () => {
  it('is empty for an empty handle', () => {
    expect(handleStatus('')).toBe('empty');
  });

  it.each(['ab', 'a'.repeat(31), '-maya', 'maya-', 'maya_reyes', 'maya.reyes', 'Maya'])('rejects %p', (h) => {
    expect(handleStatus(h)).toBe('invalid');
  });

  it.each(['abc', 'maya', 'maya-reyes', 'coach-2', 'a'.repeat(30)])('accepts %p', (h) => {
    expect(handleStatus(h)).toBe('available');
  });

  it('reports handles that clash with app routes as taken', () => {
    expect(handleStatus('login')).toBe('taken');
    expect(handleStatus('business')).toBe('taken');
  });
});

describe('validateStorefront', () => {
  it('passes a complete draft', () => {
    expect(validateStorefront(valid)).toEqual({});
  });

  it('requires a well-formed handle', () => {
    expect(validateStorefront({ ...valid, handle: 'x' }).handle).toMatch(/3–30/);
  });

  it('names the taken handle', () => {
    expect(validateStorefront({ ...valid, handle: 'admin' }).handle).toBe('instar.co/admin is taken. Try another.');
  });

  it('requires a display name that is not just whitespace', () => {
    expect(validateStorefront({ ...valid, displayName: '   ' }).displayName).toBeDefined();
  });

  it('allows a bio up to the limit and rejects one over it', () => {
    expect(validateStorefront({ ...valid, bio: 'a'.repeat(BIO_MAX) })).toEqual({});
    expect(validateStorefront({ ...valid, bio: 'a'.repeat(BIO_MAX + 1) }).bio).toBeDefined();
  });
});

describe('specialties', () => {
  it('requires at least one and allows up to the max', () => {
    expect(validateStorefront({ ...valid, specialties: [] }).specialties).toMatch(/at least one/);
    expect(validateStorefront({ ...valid, specialties: ['A', 'B', 'C'] })).toEqual({});
    expect(validateStorefront({ ...valid, specialties: ['A', 'B', 'C', 'D'] }).specialties).toMatch(/up to 3/);
    expect(validateStorefront({ ...valid, specialties: ['x'.repeat(25)] }).specialties).toBeDefined();
  });

  it('adds trimmed specialties and skips blanks, case-insensitive duplicates and overflow', () => {
    expect(addSpecialty([], '  Kettlebell   sport ')).toEqual(['Kettlebell sport']);
    expect(addSpecialty(['Strength'], 'strength')).toEqual(['Strength']);
    expect(addSpecialty(['Strength'], '   ')).toEqual(['Strength']);
    const full = ['A', 'B', 'C'];
    expect(full).toHaveLength(SPECIALTIES_MAX);
    expect(addSpecialty(full, 'D')).toBe(full);
  });
});

describe('location and time zone', () => {
  it('limits location length', () => {
    expect(validateStorefront({ ...valid, location: 'Austin, TX' })).toEqual({});
    expect(validateStorefront({ ...valid, location: 'x'.repeat(61) }).location).toBeDefined();
  });

  it('writes the location line with how they coach', () => {
    expect(locationLine({ location: ' Austin, TX ', coachingMode: 'in_person' })).toBe('Austin, TX · In person');
    expect(locationLine({ location: null, coachingMode: 'both' })).toBe('Online and in person');
  });

  it('accepts real IANA zones only', () => {
    expect(isTimeZone('America/Chicago')).toBe(true);
    expect(isTimeZone('Asia/Kolkata')).toBe(true);
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(validateStorefront({ ...valid, timeZone: 'nope' }).timeZone).toBeDefined();
  });

  it('labels a zone with its offset on a given date', () => {
    expect(timeZoneLabel('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe('America/New York (GMT-5)');
    expect(timeZoneLabel('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe('America/New York (GMT-4)');
    expect(timeZoneLabel('Asia/Kolkata', new Date('2026-07-15T12:00:00Z'))).toBe('Asia/Kolkata (GMT+5:30)');
  });
});

describe('withStorefrontDefaults', () => {
  it('fills in the rest of the profile from just a handle and display name', () => {
    const draft = withStorefrontDefaults({ handle: 'maya', displayName: 'Maya', bio: 'Hi', avatarUrl: null });
    expect(draft).toMatchObject({ handle: 'maya', bio: 'Hi', specialties: [], location: null, coachingMode: 'online', completed: false });
    expect(isTimeZone(draft.timeZone)).toBe(true);
  });

  it('keeps values that are already there', () => {
    expect(withStorefrontDefaults(valid)).toEqual(valid);
  });
});

describe('toUpdateProfileRequest', () => {
  it('drops the completed flag, which the server derives itself', () => {
    expect(toUpdateProfileRequest(valid)).toEqual({
      handle: 'maya-reyes',
      displayName: 'Maya Reyes',
      bio: null,
      avatarUrl: null,
      specialties: ['Strength'],
      location: null,
      coachingMode: 'online',
      timeZone: 'America/Chicago',
    });
  });
});

describe('fetchProfile / saveProfile (fetch wrappers)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchJson(body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
  }

  it('fetchProfile() returns the profile on success', async () => {
    mockFetchJson({ success: true, message: 'Profile loaded.', data: valid });
    expect(await fetchProfile()).toEqual({ ok: true, profile: valid });
  });

  it('saveProfile() maps the backend\'s field errors onto StorefrontField keys', async () => {
    mockFetchJson({
      success: false,
      code: 'HANDLE_TAKEN',
      message: 'maya.instar.co is taken. Try another.',
      fields: { handle: 'maya.instar.co is taken. Try another.' },
    });
    const result = await saveProfile(toUpdateProfileRequest(valid));
    expect(result).toEqual({
      ok: false,
      message: 'maya.instar.co is taken. Try another.',
      fieldErrors: { handle: 'maya.instar.co is taken. Try another.' },
    });
  });

  it('saveProfile() PATCHes /api/coach/profile and returns the saved profile on success', async () => {
    mockFetchJson({ success: true, message: 'Storefront saved.', data: valid });
    const result = await saveProfile(toUpdateProfileRequest(valid));
    expect(result).toEqual({ ok: true, profile: valid });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/coach/profile',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify(toUpdateProfileRequest(valid)) }),
    );
  });

  it('setStorefrontPublished() PATCHes /api/storefront with the published flag', async () => {
    const status = { handle: 'maya-reyes', published: true, canPublish: true, connectStatus: 'ready' as const, publicUrl: '/maya-reyes' };
    mockFetchJson({ success: true, message: "You're live.", data: status });
    const result = await setStorefrontPublished(true);
    expect(result).toEqual({ ok: true, status });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/storefront',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ published: true }) }),
    );
  });

  it('setStorefrontPublished() returns ok:false with the backend message on failure', async () => {
    mockFetchJson({ success: false, code: 'NOT_READY', message: 'Finish setting up payouts and add at least one offer before publishing.' });
    expect(await setStorefrontPublished(true)).toEqual({
      ok: false,
      message: 'Finish setting up payouts and add at least one offer before publishing.',
    });
  });
});
