'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Icon } from '@/lib/icons';
import { signup, type SignupField, type SignupState } from '@/app/(auth)/signup/actions';

const initialState: SignupState = {
  status: 'idle',
  errors: {},
  values: { name: '', email: '', handle: '' },
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="ins-field-err" id={id} role="alert">
      {message}
    </span>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [handle, setHandle] = useState('');

  if (state.status === 'success') {
    return (
      <section className="ins-panel ins-auth-card ins-auth-done ins-in" aria-live="polite">
        <span className="ins-auth-tick" aria-hidden="true">
          <Icon name="check" />
        </span>
        <span className="ins-label">Account created</span>
        <h2>Welcome to Instar, {state.firstName}.</h2>
        <p>
          Your storefront will live at <b className="ins-num">{state.values.handle}.instar.co</b>. Next, add your first
          offer and invite a client.
        </p>
        <Link href="/" className="ins-btn go ins-auth-submit">
          Go to Today
          <Icon name="arrow" />
        </Link>
      </section>
    );
  }

  const err = (f: SignupField) => state.errors[f];
  const describe = (f: SignupField) => (err(f) ? `${f}-err` : undefined);
  const shownHandle = handle || state.values.handle;

  return (
    <section className="ins-panel ins-auth-card ins-in d2" aria-labelledby="signup-title">
      <div className="ins-auth-card-h">
        <h2 id="signup-title">Create your coach account</h2>
        <p>Takes about a minute. You can change any of this later.</p>
      </div>

      <form action={formAction} noValidate className="ins-auth-form">
        <label className="ins-field">
          <span className="ins-field-l">Full name</span>
          <span className={`ins-input ${err('name') ? 'bad' : ''}`}>
            <Icon name="user" />
            <input
              name="name"
              autoComplete="name"
              placeholder="Maya Reyes"
              defaultValue={state.values.name}
              aria-invalid={!!err('name')}
              aria-describedby={describe('name')}
              required
            />
          </span>
          <FieldError id="name-err" message={err('name')} />
        </label>

        <label className="ins-field">
          <span className="ins-field-l">Work email</span>
          <span className={`ins-input ${err('email') ? 'bad' : ''}`}>
            <Icon name="mail" />
            <input
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="maya@studio.com"
              defaultValue={state.values.email}
              aria-invalid={!!err('email')}
              aria-describedby={describe('email')}
              required
            />
          </span>
          <FieldError id="email-err" message={err('email')} />
        </label>

        <label className="ins-field">
          <span className="ins-field-l">Storefront link</span>
          <span className={`ins-input ${err('handle') ? 'bad' : ''}`}>
            <Icon name="storefront" />
            <input
              name="handle"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="maya"
              defaultValue={state.values.handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              aria-invalid={!!err('handle')}
              aria-describedby={err('handle') ? 'handle-err' : 'handle-hint'}
              required
            />
            <span className="ins-input-suffix">.instar.co</span>
          </span>
          {err('handle') ? (
            <FieldError id="handle-err" message={err('handle')} />
          ) : (
            <span className="ins-field-hint" id="handle-hint">
              Clients book and pay you at {shownHandle || 'yourname'}.instar.co
            </span>
          )}
        </label>

        <label className="ins-field">
          <span className="ins-field-l">Password</span>
          <span className={`ins-input ${err('password') ? 'bad' : ''}`}>
            <Icon name="lock" />
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-invalid={!!err('password')}
              aria-describedby={describe('password')}
              minLength={8}
              required
            />
            <button
              type="button"
              className="ins-input-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              <Icon name={showPassword ? 'eyeoff' : 'eye'} />
            </button>
          </span>
          <FieldError id="password-err" message={err('password')} />
        </label>

        <label className={`ins-check ${err('terms') ? 'bad' : ''}`}>
          <input type="checkbox" name="terms" aria-invalid={!!err('terms')} aria-describedby={describe('terms')} />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <FieldError id="terms-err" message={err('terms')} />

        <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending}>
          {pending ? 'Creating your account…' : 'Create account'}
          {!pending && <Icon name="arrow" />}
        </button>
      </form>
    </section>
  );
}
