import 'server-only';
import Stripe from 'stripe';

let client: Stripe | undefined;

/**
 * Lazily constructs the Stripe client on first use. Must stay lazy: Next.js imports route
 * modules at build time to collect their config, so throwing at module-eval time (e.g. a
 * top-level `new Stripe(...)`) would fail the production build whenever STRIPE_SECRET_KEY isn't
 * set in that environment — even for routes that are never actually invoked during the build.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it in .env.local / the Vercel project env vars.');
  }
  client = new Stripe(key, {
    // Pinned to the version this SDK ships with (see node_modules/stripe/.../apiVersion.js) so a
    // future `npm update stripe` can't silently change behavior underneath us.
    apiVersion: '2026-08-26.dahlia',
    typescript: true,
    appInfo: { name: 'Instar Commerce', version: '0.1.0' },
  });
  return client;
}
