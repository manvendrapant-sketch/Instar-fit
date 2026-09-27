import { upsertClient } from './clients';

function mockDb(opts: { existing: unknown; insertReturning?: unknown[]; updateReturning?: unknown[] }) {
  const findFirst = jest.fn().mockResolvedValue(opts.existing);

  const insertReturning = jest.fn().mockResolvedValue(opts.insertReturning ?? []);
  const insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
  const insert = jest.fn().mockReturnValue({ values: insertValues });

  const updateReturning = jest.fn().mockResolvedValue(opts.updateReturning ?? []);
  const updateWhere = jest.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  return { db: { query: { clients: { findFirst } }, insert, update }, insertValues, updateSet } as const;
}

describe('upsertClient', () => {
  it('inserts a new client when none exists for (coachId, email)', async () => {
    const { db, insertValues } = mockDb({
      existing: undefined,
      insertReturning: [{ id: 'client-1', email: 'a@b.com' }],
    });

    const result = await upsertClient(db as never, {
      coachId: 'coach-1',
      email: 'a@b.com',
      name: 'Ada',
      stripeCustomerId: 'cus_1',
    });

    expect(insertValues).toHaveBeenCalledWith({ coachId: 'coach-1', email: 'a@b.com', name: 'Ada', stripeCustomerId: 'cus_1' });
    expect(result).toEqual({ id: 'client-1', email: 'a@b.com' });
  });

  it('updates the existing client, keeping prior name/stripeCustomerId when new values are null', async () => {
    const existing = { id: 'client-1', name: 'Old Name', stripeCustomerId: 'cus_old' };
    const { db, updateSet } = mockDb({ existing, updateReturning: [{ ...existing }] });

    await upsertClient(db as never, { coachId: 'coach-1', email: 'a@b.com', name: null, stripeCustomerId: null });

    expect(updateSet).toHaveBeenCalledWith({ name: 'Old Name', stripeCustomerId: 'cus_old', updatedAt: expect.any(Date) });
  });

  it('updates the existing client with new name/stripeCustomerId when provided', async () => {
    const existing = { id: 'client-1', name: 'Old Name', stripeCustomerId: 'cus_old' };
    const { db, updateSet } = mockDb({ existing, updateReturning: [{ ...existing }] });

    await upsertClient(db as never, { coachId: 'coach-1', email: 'a@b.com', name: 'New Name', stripeCustomerId: 'cus_new' });

    expect(updateSet).toHaveBeenCalledWith({ name: 'New Name', stripeCustomerId: 'cus_new', updatedAt: expect.any(Date) });
  });
});
