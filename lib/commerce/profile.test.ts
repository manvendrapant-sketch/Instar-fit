import { validateProfileInput } from './profile';

const valid = {
  handle: 'maya-reyes',
  displayName: 'Maya Reyes',
  bio: 'Strength coach',
  avatarUrl: null,
  specialties: ['Strength'],
  location: 'Austin, TX',
  coachingMode: 'online',
  timeZone: 'America/Chicago',
};

describe('validateProfileInput', () => {
  it('accepts a complete profile', () => {
    expect(validateProfileInput(valid)).toEqual({
      value: {
        handle: 'maya-reyes',
        displayName: 'Maya Reyes',
        bio: 'Strength coach',
        avatarUrl: null,
        specialties: ['Strength'],
        location: 'Austin, TX',
        coachingMode: 'online',
        timeZone: 'America/Chicago',
      },
    });
  });

  it('rejects a malformed or missing handle', () => {
    expect(validateProfileInput({ ...valid, handle: 'x' })).toHaveProperty('errors.handle');
    expect(validateProfileInput({ ...valid, handle: '' })).toHaveProperty('errors.handle');
  });

  it('rejects a handle reserved for an app route', () => {
    expect(validateProfileInput({ ...valid, handle: 'login' })).toHaveProperty('errors.handle');
    expect(validateProfileInput({ ...valid, handle: 'business' })).toHaveProperty('errors.handle');
  });

  it('requires a display name', () => {
    expect(validateProfileInput({ ...valid, displayName: '   ' })).toHaveProperty('errors.displayName');
  });

  it('limits bio length', () => {
    expect(validateProfileInput({ ...valid, bio: 'a'.repeat(161) })).toHaveProperty('errors.bio');
    expect(validateProfileInput({ ...valid, bio: 'a'.repeat(160) })).not.toHaveProperty('errors');
  });

  it('requires at least one specialty and caps at three', () => {
    expect(validateProfileInput({ ...valid, specialties: [] })).toHaveProperty('errors.specialties');
    expect(validateProfileInput({ ...valid, specialties: ['a', 'b', 'c', 'd'] })).toHaveProperty('errors.specialties');
    expect(validateProfileInput({ ...valid, specialties: ['a'.repeat(25)] })).toHaveProperty('errors.specialties');
  });

  it('limits location length', () => {
    expect(validateProfileInput({ ...valid, location: 'a'.repeat(61) })).toHaveProperty('errors.location');
  });

  it('defaults an invalid coachingMode to online rather than rejecting the whole body', () => {
    const result = validateProfileInput({ ...valid, coachingMode: 'space' });
    expect(result).toEqual({ value: expect.objectContaining({ coachingMode: 'online' }) });
  });

  it('rejects an invalid IANA time zone', () => {
    expect(validateProfileInput({ ...valid, timeZone: 'Mars/Olympus_Mons' })).toHaveProperty('errors.timeZone');
  });
});
