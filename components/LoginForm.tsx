'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { PasswordField, TextField } from '@/components/AuthFields';
import { hasErrors, readLogin, validateLogin, type FieldErrors, type LoginField } from '@/lib/auth';

export function LoginForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = validateLogin(readLogin(new FormData(e.currentTarget)));
    setErrors(next);
    // Frontend only: there are no accounts to check against, so a well-formed email and
    // password go straight to the app's homepage (Today).
    if (!hasErrors(next)) router.push('/');
  }

  return (
    <section className="ins-panel ins-auth-card ins-in d1" aria-labelledby="login-title">
      <div className="ins-auth-card-h">
        <h2 id="login-title">Log in to Instar</h2>
        <p>Welcome back. Your queue is waiting.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="ins-auth-form">
        <TextField
          name="email"
          label="Email"
          icon="mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="maya@studio.com"
          error={errors.email}
          required
        />
        <PasswordField name="password" label="Password" autoComplete="current-password" error={errors.password} />

        <button type="submit" className="ins-btn go ins-auth-submit">
          Log in
          <Icon name="arrow" />
        </button>
      </form>

      <p className="ins-auth-alt">
        New to Instar? <Link href="/signup">Create an account</Link>
      </p>
    </section>
  );
}
