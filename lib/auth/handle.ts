import { getDb } from '@/lib/commerce/db';

/**
 * Signup collects a name, not a storefront handle — the signup form has no handle field. This is
 * the only place a coach's handle is ever decided: slugify the display name and disambiguate
 * against the `coaches_handle_idx` unique index if it's taken.
 */
function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return slug || 'coach';
}

export async function generateUniqueHandle(displayName: string): Promise<string> {
  const base = slugify(displayName);
  const db = getDb();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.handle, candidate) });
    if (!existing) return candidate;
  }
  // Only reachable if `base` collides 50 times over — a random suffix beats iterating forever.
  return `${base}-${Date.now().toString(36)}`;
}
