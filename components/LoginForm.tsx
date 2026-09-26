'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { PasswordField, TextField } from '@/components/AuthFields';
import { hasErrors, login, readLogin, validateLogin, type FieldErrors, type LoginField } from '@/lib/auth';
import { useAppState } from '@/lib/store';

export function LoginForm() {
  const { toast } = useAppState();
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = readLogin(new FormData(e.currentTarget));
    const next = validateLogin(values);
    setErrors(next);
    if (hasErrors(next)) return;

    setPending(true);
    const result = await login(values).finally(() => setPending(false));

    if (result.ok) {
      // A full reload, not router.push+refresh: refresh() only re-renders server components, but
      // AppStateProvider's offers/payouts/storefront state is client-side and only ever fetched
      // once on mount — logging in as a different account than whoever was last signed in on this
      // device would otherwise keep showing that previous account's cached data until something
      // remounts the whole tree. A full reload is the only thing that reliably does.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload, see above
      window.location.href = '/';
      return;
    }
    setErrors(result.fieldErrors);
    if (!hasErrors(result.fieldErrors)) toast(result.message);
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

        <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Logging in…' : 'Log in'}
          <Icon name="arrow" />
        </button>
      </form>

      <p className="ins-auth-alt">
        New to Instar? <Link href="/signup">Create an account</Link>
      </p>
    </section>
  );
}
