'use client';

import { useState } from 'react';
import { Icon } from '@/lib/icons';
import { clientLogout } from '@/lib/clientAuth';

/**
 * The client's own minimal account landing — proves the magic-link loop end to end. The actual
 * subscription details (plan, next charge, update card, cancel, pause) are the rest of Sprint 4,
 * not built yet.
 */
export function ClientAccountView({
  email,
  name,
  coachDisplayName,
}: {
  email: string;
  name: string | null;
  coachDisplayName: string;
}) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    await clientLogout();
    // Full reload, not router.push — same reasoning as the coach login/logout flows elsewhere in
    // this app: clears any client-side state a future subscription dashboard would hold.
    window.location.href = window.location.pathname.replace(/\/account$/, '/account/login');
  }

  return (
    <section className="ins-panel ins-auth-card ins-in" aria-labelledby="client-account-title">
      <div className="ins-auth-card-h">
        <h2 id="client-account-title">{name ? `Hi, ${name.split(' ')[0]}` : "You're logged in"}</h2>
        <p>
          {email} · working with {coachDisplayName}
        </p>
      </div>
      <p className="ins-field-hint">
        Your subscription details, card update and cancel/pause options aren&rsquo;t built yet — this page just confirms
        you&rsquo;re logged in.
      </p>
      <button type="button" className="ins-btn ins-auth-submit" onClick={onLogout} disabled={loggingOut}>
        {loggingOut ? 'Logging out…' : 'Log out'}
        <Icon name="logout" />
      </button>
    </section>
  );
}
