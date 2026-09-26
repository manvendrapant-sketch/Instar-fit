import { ImageResponse } from 'next/og';
import { DEMO_HANDLE, DEMO_STOREFRONT, handleToName } from '@/lib/publicStorefront';
import { storefrontLink } from '@/lib/storefront';

// The card shown when a coach's link is pasted into Instagram, iMessage or WhatsApp. Colours are
// the Obsidian+ dark tokens, inlined because ImageResponse can't read CSS variables.
export const alt = 'Coach storefront on Instar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#08090B';
const TEXT = '#F3F4F6';
const MUTED = '#9197A2';
const ACCENT = '#5CD6FF';

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const h = decodeURIComponent(handle).toLowerCase();
  const demo = h === DEMO_HANDLE;
  const name = demo ? DEMO_STOREFRONT.displayName : handleToName(h);
  const tags = demo ? DEMO_STOREFRONT.specialties : [];
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: `radial-gradient(900px 520px at 85% -10%, rgba(92,214,255,.22), transparent 70%), ${BG}`,
          color: TEXT,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 75,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #C9A58A, #7A4F3A)',
              fontSize: 60,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 76, letterSpacing: -3, lineHeight: 1 }}>{name}</div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 12 }}>
                {tags.map((t) => (
                  <div
                    key={t}
                    style={{ fontSize: 26, padding: '6px 18px', borderRadius: 999, border: '2px solid rgba(255,255,255,.14)' }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 34, color: MUTED }}>Coaching, programs and sessions</div>
            <div style={{ fontSize: 40, color: ACCENT }}>{storefrontLink(h)}</div>
          </div>
          <div style={{ fontSize: 30, color: MUTED }}>Instar</div>
        </div>
      </div>
    ),
    size,
  );
}
