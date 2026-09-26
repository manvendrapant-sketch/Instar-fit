import 'dotenv/config';
import { getDb } from '../lib/commerce/db';
import { clients, coaches, connectedAccounts, offers, prices } from '../lib/commerce/schema';

/**
 * Sprint 1 seed: one test coach with all three offer types, so Pari has real-shaped data to
 * build the storefront and offer builder against before checkout exists.
 *
 * Run with: npm run db:seed (requires DATABASE_URL to point at a real Postgres instance).
 */
async function main() {
  const db = getDb();
  console.log('Seeding commerce test data...');

  const [coach] = await db
    .insert(coaches)
    .values({
      handle: 'maya-test',
      email: 'maya+test@instar.dev',
      displayName: 'Maya Reyes',
      bio: 'Strength coach for busy professionals. 1:1 and small-group programming.',
    })
    .onConflictDoNothing({ target: coaches.handle })
    .returning();

  const coachRow = coach ?? (await db.query.coaches.findFirst({ where: (c, { eq }) => eq(c.handle, 'maya-test') }));
  if (!coachRow) throw new Error('Failed to create or find the test coach');

  await db
    .insert(connectedAccounts)
    .values({
      coachId: coachRow.id,
      stripeAccountId: 'acct_test_placeholder',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirementsDue: ['individual.verification.document'],
    })
    .onConflictDoNothing({ target: connectedAccounts.coachId });

  const offerSeeds = [
    {
      type: 'subscription' as const,
      name: '1:1 Coaching',
      description: 'Monthly coaching: programming, weekly check-ins, unlimited messaging.',
      unitAmountCents: 19_900,
      interval: 'month' as const,
      intervalCount: 1,
    },
    {
      type: 'one_time' as const,
      name: '12-Week Strength Program',
      description: 'A complete 12-week program you run on your own, with check-ins built in.',
      unitAmountCents: 14_900,
      interval: null,
      intervalCount: null,
    },
    {
      type: 'session' as const,
      name: 'Single Consult Call',
      description: 'A 45-minute video call to assess where you are and build a plan.',
      unitAmountCents: 7_500,
      interval: null,
      intervalCount: null,
    },
  ];

  for (const seed of offerSeeds) {
    const [offer] = await db
      .insert(offers)
      .values({
        coachId: coachRow.id,
        type: seed.type,
        name: seed.name,
        description: seed.description,
      })
      .returning();

    await db.insert(prices).values({
      offerId: offer.id,
      unitAmountCents: seed.unitAmountCents,
      interval: seed.interval,
      intervalCount: seed.intervalCount,
    });
  }

  await db
    .insert(clients)
    .values({
      coachId: coachRow.id,
      email: 'leah+test@instar.dev',
      name: 'Leah Kim',
    })
    .onConflictDoNothing();

  console.log(`Seeded coach "${coachRow.handle}" with ${offerSeeds.length} offers.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
