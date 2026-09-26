'use server';

export type SignupField = 'name' | 'email' | 'password' | 'confirm' | 'terms';

export interface SignupState {
  status: 'idle' | 'error' | 'success';
  errors: Partial<Record<SignupField, string>>;
  /** Echoed back so the form keeps what the coach typed (never the passwords). */
  values: { name: string; email: string };
  firstName?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const terms = formData.get('terms') === 'on';

  const errors: SignupState['errors'] = {};
  if (!name) errors.name = 'Add your name so clients know who they’re booking.';
  if (!EMAIL.test(email)) errors.email = 'Enter an email address like you@studio.com.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!confirm) errors.confirm = 'Type your password again.';
  else if (confirm !== password) errors.confirm = 'Passwords don’t match.';
  if (!terms) errors.terms = 'Agree to the terms to create your account.';

  const values = { name, email };
  if (Object.keys(errors).length > 0) return { status: 'error', errors, values };

  // Prototype: there is no auth backend or database yet, so nothing is persisted here.
  // Replace with real account creation (and password hashing) once the auth stack lands.
  return { status: 'success', errors: {}, values, firstName: name.split(/\s+/)[0] };
}
