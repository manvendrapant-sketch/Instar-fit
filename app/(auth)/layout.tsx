import { AuthBar } from '@/components/AuthBar';

// Signed-out chrome: logo and theme toggle only, no sidebar or command palette.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ins-page ins-auth-page">
      <AuthBar />
      <main className="ins-auth" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
