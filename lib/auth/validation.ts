/**
 * Hand-rolled input validation for the auth routes. No validation library is used elsewhere in
 * this app, so this stays consistent rather than introducing one (e.g. zod) for two endpoints.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateSignupInput(body: unknown): { errors: Record<string, string> } | { value: SignupInput } {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const email = isNonEmptyString(b.email) ? b.email.trim().toLowerCase() : '';
  const password = isNonEmptyString(b.password) ? b.password : '';
  const displayName = isNonEmptyString(b.displayName) ? b.displayName.trim() : '';

  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';

  if (!displayName) errors.displayName = 'Name is required.';

  if (Object.keys(errors).length > 0) return { errors };
  return { value: { email, password, displayName } };
}

export function validateLoginInput(body: unknown): { errors: Record<string, string> } | { value: LoginInput } {
  const errors: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const email = isNonEmptyString(b.email) ? b.email.trim().toLowerCase() : '';
  const password = isNonEmptyString(b.password) ? b.password : '';

  if (!email) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';

  if (Object.keys(errors).length > 0) return { errors };
  return { value: { email, password } };
}
