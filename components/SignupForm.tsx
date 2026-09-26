'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { FieldError, PasswordField, TextField } from '@/components/AuthFields';
import { hasErrors, readSignup, signup, validateSignup, type FieldErrors, type SignupField } from '@/lib/auth';
import { useAppState } from '@/lib/store';

export function SignupForm() {
  const { toast } = useAppState();
  const [errors, setErrors] = useState<FieldErrors<SignupField>>({});
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ firstName: string; email: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = readSignup(new FormData(e.currentTarget));
    const next = validateSignup(values);
    setErrors(next);
    if (hasErrors(next)) return;

    setPending(true);
    const result = await signup(values).finally(() => setPending(false));

    if (result.ok) {
      setCreated({ firstName: values.name.split(/\s+/)[0], email: values.email });
      return;
    }
    setErrors(result.fieldErrors);
    if (!hasErrors(result.fieldErrors)) toast(result.message);
  }

  if (created) {
    // Signup already set the session cookie, so this is really "enter the app," not "log in
    // again" — a plain <Link href="/login"> would bounce through proxy.ts's already-signed-in
    // redirect back to "/". A full reload rather than router.push+refresh: refresh() only
    // re-renders server components, but AppStateProvider's offers/payouts/storefront state is
    // client-side and only ever fetched once on mount — it would otherwise keep showing whichever
    // account was last signed in on this device until something remounts the whole tree.
    function enterApp() {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full reload, see above
      window.location.href = '/';
    }
    return (
      <section className="ins-panel ins-auth-card ins-auth-done ins-in" aria-live="polite">
        <span className="ins-auth-tick" aria-hidden="true">
          <Icon name="check" />
        </span>
        <span className="ins-label">Account created</span>
        <h2>Welcome to Instar, {created.firstName}.</h2>
        <p>
          You&rsquo;re signed in as <b>{created.email}</b>.
        </p>
        <button type="button" className="ins-btn go ins-auth-submit" onClick={enterApp}>
          Continue
          <Icon name="arrow" />
        </button>
      </section>
    );
  }

  return (
    <section className="ins-panel ins-auth-card ins-in d2" aria-labelledby="signup-title">
      <div className="ins-auth-card-h">
        <h2 id="signup-title">Create your coach account</h2>
        <p>Takes about a minute.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="ins-auth-form">
        <TextField
          name="name"
          label="Full name"
          icon="user"
          autoComplete="name"
          placeholder="Maya Reyes"
          error={errors.name}
          required
        />
        <TextField
          name="email"
          label="Work email"
          icon="mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="maya@studio.com"
          error={errors.email}
          required
        />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password}
        />
        <PasswordField
          name="confirm"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Type it again"
          error={errors.confirm}
        />

        <label className={`ins-check ${errors.terms ? 'bad' : ''}`}>
          <input
            type="checkbox"
            name="terms"
            aria-invalid={!!errors.terms}
            aria-describedby={errors.terms ? 'terms-err' : undefined}
          />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <FieldError id="terms-err" message={errors.terms} />

        <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Creating account…' : 'Create account'}
          <Icon name="arrow" />
        </button>
      </form>

      <p className="ins-auth-alt">
        Already on Instar? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}
