'use server';

import { redirect } from 'next/navigation';

export interface StorefrontSetupState {
  errors: { handle?: string };
  handle: string;
}

const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export async function setupStorefront(_prev: StorefrontSetupState, formData: FormData): Promise<StorefrontSetupState> {
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase();

  if (!HANDLE.test(handle)) {
    return { errors: { handle: 'Use 3–30 lowercase letters, numbers or hyphens.' }, handle };
  }

  // Prototype: nothing is persisted. Once the Commerce schema exists this should reserve the
  // handle (unique) on the coach's storefront record before continuing.
  redirect('/');
}
