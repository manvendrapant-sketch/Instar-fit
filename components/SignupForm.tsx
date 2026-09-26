'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Icon } from '@/lib/icons';
import { FieldError, PasswordField, TextField } from '@/components/AuthFields';
import { signup, type SignupState } from '@/app/(auth)/signup/actions';

const initialState: SignupState = { status: 'idle', errors: {}, values: { name: '', email: '' } };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);
  const { errors, values } = state;

  if (state.status === 'success') {
    return (
      <section className="ins-panel ins-auth-card ins-auth-done ins-in" aria-live="polite">
        <span className="ins-auth-tick" aria-hidden="true">
          <Icon name="check" />
        </span>
        <span className="ins-label">Account created</span>
        <h2>Welcome to Instar, {state.firstName}.</h2>
        <p>
          Log in with <b>{values.email}</b> to get started.
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

      <form action={formAction} noValidate className="ins-auth-form">
        <TextField
          name="name"
          label="Full name"
          icon="user"
          autoComplete="name"
          placeholder="Maya Reyes"
          defaultValue={values.name}
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
          defaultValue={values.email}
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

        <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending}>
          {pending ? 'Creating your account…' : 'Create account'}
          {!pending && <Icon name="arrow" />}
        </button>
      </form>

      <p className="ins-auth-alt">
        Already on Instar? <Link href="/login">Log in</Link>
      </p>
    </section>
  );
}
