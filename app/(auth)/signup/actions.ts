'use server';

export type SignupField = 'name' | 'email' | 'handle' | 'password' | 'terms';

export interface SignupState {
  status: 'idle' | 'error' | 'success';
  errors: Partial<Record<SignupField, string>>;
  /** Echoed back so the form keeps what the coach typed (never the password). */
  values: { name: string; email: string; handle: string };
  firstName?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const terms = formData.get('terms') === 'on';

  const errors: SignupState['errors'] = {};
  if (!name) errors.name = 'Add your name so clients know who they’re booking.';
  if (!EMAIL.test(email)) errors.email = 'Enter an email address like you@studio.com.';
  if (!HANDLE.test(handle)) errors.handle = 'Use 3–30 lowercase letters, numbers or hyphens.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!terms) errors.terms = 'Agree to the terms to create your account.';

  const values = { name, email, handle };
  if (Object.keys(errors).length > 0) return { status: 'error', errors, values };

  // Prototype: there is no auth backend or database yet, so nothing is persisted here.
  // Replace with real account creation (and password hashing) once the auth stack lands.
  return { status: 'success', errors: {}, values, firstName: name.split(/\s+/)[0] };
}
