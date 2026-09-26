// Client-side form checks for sign up and log in. Frontend only: nothing here talks to a
// server or stores anything. When a real auth backend exists, it must repeat these checks.

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
