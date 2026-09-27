import 'server-only';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import { clients } from './schema';

type Db = PostgresJsDatabase<typeof schema>;

export interface UpsertClientInput {
  coachId: string;
  email: string;
  name: string | null;
  stripeCustomerId: string | null;
}

/**
 * Finds a coach's client by (coachId, email) and updates it, or inserts a new row. There's no DB
 * unique constraint on (coachId, email) — a genuine race here just creates two rows for the same
 * person, an acceptable cost given how rarely a client's checkout and any other write would land
 * in the same instant, and consistent with how loosely this schema is constrained elsewhere.
 */
export async function upsertClient(db: Db, input: UpsertClientInput): Promise<typeof clients.$inferSelect> {
  const existing = await db.query.clients.findFirst({
    where: (c, { eq: eqCol, and: andCol }) => andCol(eqCol(c.coachId, input.coachId), eqCol(c.email, input.email)),
  });

  if (existing) {
    const [updated] = await db
      .update(clients)
      .set({
        name: input.name ?? existing.name,
        stripeCustomerId: input.stripeCustomerId ?? existing.stripeCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(clients)
    .values({ coachId: input.coachId, email: input.email, name: input.name, stripeCustomerId: input.stripeCustomerId })
    .returning();
  return created;
}
