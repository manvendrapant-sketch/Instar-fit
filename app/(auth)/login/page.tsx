import type { Metadata } from 'next';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = {
  title: 'Log in · Instar',
  description: 'Log in to your Instar coach account.',
};

export default function LoginPage() {
  return (
    <div className="ins-auth-solo">
      <LoginForm />
    </div>
  );
}
