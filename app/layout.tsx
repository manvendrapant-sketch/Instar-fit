import type { Metadata } from 'next';
import { Unbounded, Figtree, IBM_Plex_Mono } from 'next/font/google';
import { AppStateProvider } from '@/lib/store';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';
import { Toast } from '@/components/Toast';
import './globals.css';

const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-unbounded',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-figtree',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Instar',
  description: 'Instar — the coaching business app that tells you what needs you today.',
};

// Avoids a light/dark flash: sets data-theme from localStorage before first paint.
const themeInitScript = `(function(){try{var t=JSON.parse(localStorage.getItem('ins_theme')||'"dark"');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${unbounded.variable} ${figtree.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="ins">
        <AppStateProvider>
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
          <Toast />
        </AppStateProvider>
      </body>
    </html>
  );
}
