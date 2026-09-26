'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Icon } from '@/lib/icons';
import { PasswordField, TextField } from '@/components/AuthFields';
import { login, type LoginState } from '@/app/(auth)/login/actions';

const initialState: LoginState = { errors: {}, email: '' };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <section className="ins-panel ins-auth-card ins-in d1" aria-labelledby="login-title">
      <div className="ins-auth-card-h">
        <h2 id="login-title">Log in to Instar</h2>
        <p>Welcome back. Your queue is waiting.</p>
      </div>

      <form action={formAction} noValidate className="ins-auth-form">
        <TextField
          name="email"
          label="Email"
          icon="mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="maya@studio.com"
          defaultValue={state.email}
          error={state.errors.email}
          required
        />
        <PasswordField name="password" label="Password" autoComplete="current-password" error={state.errors.password} />

        <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
          {!pending && <Icon name="arrow" />}
        </button>
      </form>

      <p className="ins-auth-alt">
        New to Instar? <Link href="/signup">Create an account</Link>
      </p>
    </section>
  );
}
