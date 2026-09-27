import { createHash } from 'crypto';
import { generateLoginToken, hashLoginToken } from './clientToken';

describe('generateLoginToken', () => {
  it('generates distinct, URL-safe tokens', () => {
    const a = generateLoginToken();
    const b = generateLoginToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('hashLoginToken', () => {
  it('is a deterministic sha256 hash of the token', () => {
    const token = 'some-token-value';
    expect(hashLoginToken(token)).toEqual(createHash('sha256').update(token).digest('hex'));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashLoginToken('a')).not.toEqual(hashLoginToken('b'));
  });
});
