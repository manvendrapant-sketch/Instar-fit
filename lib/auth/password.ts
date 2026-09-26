import bcrypt from 'bcryptjs';

// No `server-only` guard here (unlike lib/auth/session.ts): scripts/seed-commerce.ts imports this
// directly via `tsx`, which — like drizzle-kit — never goes through Next's bundler, so the guard
// would trip immediately. Same reasoning as lib/commerce/schema.ts / db.ts.

const SALT_ROUNDS = 12;

export function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

export function verifyPassword(plainTextPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
