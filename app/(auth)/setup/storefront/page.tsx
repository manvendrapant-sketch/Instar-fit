import type { Metadata } from 'next';
import { StorefrontSetupForm } from '@/components/StorefrontSetupForm';

export const metadata: Metadata = {
  title: 'Set up your storefront · Instar',
};

export default function StorefrontSetupPage() {
  return (
    <div className="ins-auth-solo">
      <StorefrontSetupForm />
    </div>
  );
}
