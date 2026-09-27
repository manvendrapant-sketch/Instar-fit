import 'server-only';
import { getResend } from './resend';

// Resend's own sandbox sender — works with no domain verification, but only delivers to the
// Resend account owner's own verified address until a real sending domain is set up. Fine for
// testing this flow; swap via EMAIL_FROM once a domain is verified.
const DEFAULT_FROM = 'Instar <onboarding@resend.dev>';

/**
 * The client's magic-link login email. One email, one job — a future dunning/receipt email
 * template is a separate function, not a param added to this one.
 */
export async function sendMagicLinkEmail(to: string, loginUrl: string, coachDisplayName: string): Promise<void> {
  await getResend().emails.send({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to,
    subject: 'Log in to your account',
    html: `
      <p>Tap below to view your subscription with ${escapeHtml(coachDisplayName)}.</p>
      <p><a href="${loginUrl}">Log in</a></p>
      <p>This link expires in 15 minutes and can only be used once. If you didn't request it, you can ignore this email.</p>
    `,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
