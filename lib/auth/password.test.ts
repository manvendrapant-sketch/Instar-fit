import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('hashPassword / verifyPassword', () => {
  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('supersecret1');
    expect(hash).not.toBe('supersecret1');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifies the correct password against its own hash', async () => {
    const hash = await hashPassword('supersecret1');
    await expect(verifyPassword('supersecret1', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('supersecret1');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt), yet both still verify', async () => {
    const [hashA, hashB] = await Promise.all([hashPassword('supersecret1'), hashPassword('supersecret1')]);
    expect(hashA).not.toBe(hashB);
    await expect(verifyPassword('supersecret1', hashA)).resolves.toBe(true);
    await expect(verifyPassword('supersecret1', hashB)).resolves.toBe(true);
  });
});
