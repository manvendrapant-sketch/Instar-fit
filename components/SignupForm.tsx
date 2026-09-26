'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { FieldError, PasswordField, TextField } from '@/components/AuthFields';
import { hasErrors, readSignup, validateSignup, type FieldErrors, type SignupField } from '@/lib/auth';

export function SignupForm() {
  const [errors, setErrors] = useState<FieldErrors<SignupField>>({});
  const [created, setCreated] = useState<{ firstName: string; email: string } | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = readSignup(new FormData(e.currentTarget));
    const next = validateSignup(values);
    setErrors(next);
    // Frontend only: nothing is saved; a valid form just shows the confirmation.
    if (!hasErrors(next)) setCreated({ firstName: values.name.split(/\s+/)[0], email: values.email });
  }

  if (created) {
    return (
      <section className="ins-panel ins-auth-card ins-auth-done ins-in" aria-live="polite">
        <span className="ins-auth-tick" aria-hidden="true">
          <Icon name="check" />
        </span>
        <span className="ins-label">Account created</span>
        <h2>Welcome to Instar, {created.firstName}.</h2>
        <p>
          Log in with <b>{created.email}</b> to get started.
        </p>
        <Link href="/login" className="ins-btn go ins-auth-submit">
          Log in
          <Icon name="arrow" />
        </Link>
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

        <button type="submit" className="ins-btn go ins-auth-submit">
          Create account
          <Icon name="arrow" />
        </button>
      </form>

      <p className="ins-auth-alt">
        Already on Instar? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}
