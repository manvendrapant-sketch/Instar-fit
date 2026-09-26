import type { Metadata } from 'next';
import { Sora, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { AppStateProvider } from '@/lib/store';
import { Toast } from '@/components/Toast';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sora',
  display: 'swap',
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken-grotesk',
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
    <html lang="en" data-theme="dark" className={`${sora.variable} ${hankenGrotesk.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="ins">
        <AppStateProvider>
          {children}
          <Toast />
        </AppStateProvider>
      </body>
    </html>
  );
}
