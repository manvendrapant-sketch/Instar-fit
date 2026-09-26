import { BIO_MAX, handleStatus, normalizeHandle, validateStorefront, type StorefrontDraft } from './storefront';

const valid: StorefrontDraft = { handle: 'maya-reyes', displayName: 'Maya Reyes', bio: null, avatarUrl: null };

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
    expect(validateStorefront({ ...valid, handle: 'admin' }).handle).toBe('admin.instar.co is taken. Try another.');
  });

  it('requires a display name that is not just whitespace', () => {
    expect(validateStorefront({ ...valid, displayName: '   ' }).displayName).toBeDefined();
  });

  it('allows a bio up to the limit and rejects one over it', () => {
    expect(validateStorefront({ ...valid, bio: 'a'.repeat(BIO_MAX) })).toEqual({});
    expect(validateStorefront({ ...valid, bio: 'a'.repeat(BIO_MAX + 1) }).bio).toBeDefined();
  });
});
