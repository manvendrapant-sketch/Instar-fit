import 'server-only';
import { Resend } from 'resend';

let client: Resend | undefined;

/**
 * Lazy on purpose — same gotcha as lib/stripe/client.ts and lib/commerce/db.ts. Next.js imports
 * every route module at build time to collect its config, so a top-level `new Resend(...)` that
 * throws when RESEND_API_KEY is missing would fail `next build` outright, even for routes never
 * invoked during the build.
 */
export function getResend(): Resend {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set. Add it in .env.local / the Vercel project env vars.');
  }
  client = new Resend(key);
  return client;
}
