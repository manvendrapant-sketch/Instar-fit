import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let client: PostgresJsDatabase<typeof schema> | undefined;

/**
 * Lazily constructs the DB client on first use — see the comment in lib/stripe/client.ts for why
 * this must not run at module-eval time (Next.js's build-time route collection would break
 * whenever DATABASE_URL isn't set in that environment).
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Provision a Postgres database (Vercel Postgres, Neon, Supabase, ...) ' +
        'and set DATABASE_URL in .env.local / the Vercel project env vars.',
    );
  }
  const sql = postgres(url, { max: 1 });
  client = drizzle(sql, { schema });
  return client;
}
