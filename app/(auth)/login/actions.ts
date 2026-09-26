'use server';

import { redirect } from 'next/navigation';

export interface LoginState {
  errors: { email?: string; password?: string };
  email: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  const errors: LoginState['errors'] = {};
  if (!EMAIL.test(email)) errors.email = 'Enter the email you signed up with.';
  if (!password) errors.password = 'Enter your password.';
  if (Object.keys(errors).length > 0) return { errors, email };

  // Prototype: there is no auth backend yet, so any well-formed email + password gets in.
  // Replace with a real credential check and session cookie once the auth stack lands.
  // Sign up → log in → the app's homepage (Today).
  redirect('/');
}
