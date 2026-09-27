'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '@/lib/icons';
import { TextField } from '@/components/AuthFields';
import { requestClientLoginLink } from '@/lib/clientAuth';

/**
 * A client's entry point to their own "my subscription" view — no password, ever. They type the
 * email they checked out with; we always show the same "check your email" confirmation whether or
 * not that email actually has an account with this coach (never reveal which via the response).
 */
export function ClientLoginForm({ handle, coachDisplayName }: { handle: string; coachDisplayName: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email.');
      return;
    }
    setError(undefined);
    setPending(true);
    await requestClientLoginLink(handle, trimmed);
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <section className="ins-panel ins-auth-card ins-auth-done ins-in" aria-live="polite">
        <span className="ins-auth-tick" aria-hidden="true">
          <Icon name="mail" />
        </span>
        <span className="ins-label">Check your email</span>
        <h2>We&rsquo;ve sent a login link</h2>
        <p>
          If <b>{email.trim()}</b> has an account with {coachDisplayName}, a link to log in just arrived. It expires in 15
          minutes and works once.
        </p>
      </section>
    );
  }

  return (
    <section className="ins-panel ins-auth-card ins-in" aria-labelledby="client-login-title">
      <div className="ins-auth-card-h">
        <h2 id="client-login-title">Log in</h2>
        <p>Enter the email you used with {coachDisplayName} and we&rsquo;ll send you a link — no password needed.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="ins-auth-form">
        <TextField
          name="email"
          label="Email"
          icon="mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          required
        />
        <button type="submit" className="ins-btn go ins-auth-submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Sending…' : 'Send login link'}
          <Icon name="arrow" />
        </button>
      </form>
    </section>
  );
}
