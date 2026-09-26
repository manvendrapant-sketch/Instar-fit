// Client-side form checks for sign up and log in, plus the fetch wrappers that call the real
// /api/auth/* routes (app/api/auth/*/route.ts). Client-side validation still runs first purely
// for instant feedback — the backend re-validates everything itself and is the actual source of
// truth (never trust it from here alone).

export type SignupField = 'name' | 'email' | 'password' | 'confirm' | 'terms';
export type LoginField = 'email' | 'password';
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readSignup(form: FormData) {
  return {
    name: String(form.get('name') ?? '').trim(),
    email: String(form.get('email') ?? '').trim().toLowerCase(),
    password: String(form.get('password') ?? ''),
    confirm: String(form.get('confirm') ?? ''),
    terms: form.get('terms') === 'on',
  };
}

export function validateSignup(v: ReturnType<typeof readSignup>): FieldErrors<SignupField> {
  const errors: FieldErrors<SignupField> = {};
  if (!v.name) errors.name = 'Add your name so clients know who they’re booking.';
  if (!EMAIL.test(v.email)) errors.email = 'Enter an email address like you@studio.com.';
  if (v.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!v.confirm) errors.confirm = 'Type your password again.';
  else if (v.confirm !== v.password) errors.confirm = 'Passwords don’t match.';
  if (!v.terms) errors.terms = 'Agree to the terms to create your account.';
  return errors;
}

export function readLogin(form: FormData) {
  return {
    email: String(form.get('email') ?? '').trim().toLowerCase(),
    password: String(form.get('password') ?? ''),
  };
}

export function validateLogin(v: ReturnType<typeof readLogin>): FieldErrors<LoginField> {
  const errors: FieldErrors<LoginField> = {};
  if (!EMAIL.test(v.email)) errors.email = 'Enter the email you signed up with.';
  if (!v.password) errors.password = 'Enter your password.';
  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

// --- Backend calls -----------------------------------------------------------------------

export interface AuthedCoach {
  id: string;
  email: string;
  handle: string;
  displayName: string;
}

// Mirrors lib/api/response.ts's envelope — duplicated (rather than imported) because that file
// pulls in `next/server`, which client components can't bundle.
type ApiResult<T> =
  | { success: true; message: string; data: T }
  | { success: false; code: string; message: string; fields?: Record<string, string> };

async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as ApiResult<T>;
}

// The backend validates displayName/email/password; it knows nothing about "name" or "confirm"
// (those are this form's own fields — confirm never leaves the browser, and "name" is sent as
// displayName). This maps its field keys back onto this form's own field names.
function mapSignupFields(fields?: Record<string, string>): FieldErrors<SignupField> {
  if (!fields) return {};
  const errors: FieldErrors<SignupField> = {};
  if (fields.displayName) errors.name = fields.displayName;
  if (fields.email) errors.email = fields.email;
  if (fields.password) errors.password = fields.password;
  return errors;
}

export async function signup(v: ReturnType<typeof readSignup>): Promise<
  { ok: true; coach: AuthedCoach } | { ok: false; message: string; fieldErrors: FieldErrors<SignupField> }
> {
  const result = await postJson<{ coach: AuthedCoach }>('/api/auth/signup', {
    email: v.email,
    password: v.password,
    displayName: v.name,
  });
  if (result.success) return { ok: true, coach: result.data.coach };
  return { ok: false, message: result.message, fieldErrors: mapSignupFields(result.fields) };
}

export async function login(v: ReturnType<typeof readLogin>): Promise<
  { ok: true; coach: AuthedCoach } | { ok: false; message: string; fieldErrors: FieldErrors<LoginField> }
> {
  const result = await postJson<{ coach: AuthedCoach }>('/api/auth/login', v);
  if (result.success) return { ok: true, coach: result.data.coach };
  const fieldErrors: FieldErrors<LoginField> = {};
  if (result.fields?.email) fieldErrors.email = result.fields.email;
  if (result.fields?.password) fieldErrors.password = result.fields.password;
  return { ok: false, message: result.message, fieldErrors };
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

/** "Maya Reyes" -> "MR", for the initials badge in TopBar/Sidebar. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}
