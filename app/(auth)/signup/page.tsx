import type { Metadata } from 'next';
import { Icon, type IconName } from '@/lib/icons';
import { SignupForm } from '@/components/SignupForm';

export const metadata: Metadata = {
  title: 'Sign up · Instar',
  description: 'Create your Instar coach account: your storefront, clients and payouts in one place.',
};

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'storefront', title: 'Your own storefront', body: 'Set it up after you log in: offers, checkout and a link to share.' },
  { icon: 'today', title: 'A queue, not a dashboard', body: 'Each morning, the check-ins, leads and payments that need you.' },
  { icon: 'clientspace', title: 'Drafts in your voice', body: 'Instar writes the message. Nothing goes out until you approve it.' },
];

export default function SignupPage() {
  return (
    <div className="ins-auth-grid">
      <section className="ins-auth-pitch">
        <span className="ins-label ins-in">For coaches</span>
        <h1 className="ins-auth-h ins-in d1">
          Run your coaching <em>business</em> <span>from one place.</span>
        </h1>
        <p className="ins-auth-lede ins-in d2">
          Clients, check-ins, programs and payouts, with Instar telling you what needs you next.
        </p>
        <ul className="ins-auth-points ins-in d3">
          {POINTS.map((p) => (
            <li key={p.title}>
              <Icon name={p.icon} />
              <div>
                <b>{p.title}</b>
                <span>{p.body}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <SignupForm />
    </div>
  );
}
