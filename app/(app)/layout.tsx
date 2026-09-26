import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';

// Coach dashboard chrome: top bar, sidebar directory and command palette.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="ins-page">
        <TopBar />
        <div className="ins-app">
          <Sidebar />
          <main className="ins-wrap" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </>
  );
}
