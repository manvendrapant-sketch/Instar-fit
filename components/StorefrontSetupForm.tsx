'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Icon } from '@/lib/icons';
import { TextField } from '@/components/AuthFields';
import { setupStorefront, type StorefrontSetupState } from '@/app/(auth)/setup/storefront/actions';

const initialState: StorefrontSetupState = { errors: {}, handle: '' };

export function StorefrontSetupForm() {
  const [state, formAction, pending] = useActionState(setupStorefront, initialState);
  const [handle, setHandle] = useState('');
  const shown = handle || state.handle;

  return (
    <section className="ins-panel ins-auth-card ins-in d1" aria-labelledby="storefront-title">
      <div className="ins-auth-card-h">
        <span className="ins-label">Step 1 · Storefront</span>
        <h2 id="storefront-title">Set up your storefront</h2>
        <p>This is the link clients use to find your offers, book and pay you.</p>
      </div>

      <form action={formAction} noValidate className="ins-auth-form">
        <TextField
          name="handle"
          label="Storefront link"
          icon="storefront"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="maya"
          defaultValue={state.handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase())}
          suffix=".instar.co"
          error={state.errors.handle}
          hint={`Clients book and pay you at ${shown || 'yourname'}.instar.co`}
          required
        />

        <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending}>
          {pending ? 'Saving…' : 'Continue'}
          {!pending && <Icon name="arrow" />}
        </button>
      </form>

      <p className="ins-auth-alt">
        <Link href="/">Skip for now</Link>
      </p>
    </section>
  );
}
