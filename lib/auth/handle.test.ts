import { generateUniqueHandle } from '@/lib/auth/handle';
import { getDb } from '@/lib/commerce/db';

jest.mock('@/lib/commerce/db');

function mockFindFirst(...results: (object | undefined)[]) {
  const findFirst = jest.fn();
  results.forEach((r) => findFirst.mockResolvedValueOnce(r));
  (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst } } });
  return findFirst;
}

describe('generateUniqueHandle', () => {
  it('slugifies the display name: lowercase, spaces to hyphens', async () => {
    mockFindFirst(undefined);
    await expect(generateUniqueHandle('Maya Reyes')).resolves.toBe('maya-reyes');
  });

  it('strips accents and non-alphanumeric characters', async () => {
    mockFindFirst(undefined);
    await expect(generateUniqueHandle("José O'Brien-Núñez!!")).resolves.toBe('jose-o-brien-nunez');
  });

  it('collapses runs of punctuation into a single hyphen and trims leading/trailing hyphens', async () => {
    mockFindFirst(undefined);
    await expect(generateUniqueHandle('  ---Maya   Reyes---  ')).resolves.toBe('maya-reyes');
  });

  it('truncates to 30 characters', async () => {
    mockFindFirst(undefined);
    const handle = await generateUniqueHandle('A Very Long Coach Display Name Indeed');
    expect(handle.length).toBeLessThanOrEqual(30);
  });

  it('falls back to "coach" for a name with no alphanumeric characters', async () => {
    mockFindFirst(undefined);
    await expect(generateUniqueHandle('!!!')).resolves.toBe('coach');
  });

  it('appends -2 when the base handle is already taken', async () => {
    const findFirst = mockFindFirst({ id: 'existing' }, undefined);
    await expect(generateUniqueHandle('Maya Reyes')).resolves.toBe('maya-reyes-2');
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('keeps incrementing past multiple collisions', async () => {
    const findFirst = mockFindFirst({ id: '1' }, { id: '2' }, { id: '3' }, undefined);
    await expect(generateUniqueHandle('Maya Reyes')).resolves.toBe('maya-reyes-4');
    expect(findFirst).toHaveBeenCalledTimes(4);
  });

  it('falls back to a timestamp suffix after 50 straight collisions', async () => {
    const alwaysTaken = jest.fn().mockResolvedValue({ id: 'taken' });
    (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst: alwaysTaken } } });

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    await expect(generateUniqueHandle('Maya Reyes')).resolves.toBe(
      `maya-reyes-${(1_700_000_000_000).toString(36)}`,
    );
    expect(alwaysTaken).toHaveBeenCalledTimes(50);
    nowSpy.mockRestore();
  });
});
