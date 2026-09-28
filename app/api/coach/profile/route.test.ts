import { GET, PATCH } from '@/app/api/coach/profile/route';
import { getDb } from '@/lib/commerce/db';
import { verifySessionToken } from '@/lib/auth/session';
import { requireCoachSession } from '@/lib/auth/require-coach';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/auth/require-coach');

const SESSION = { coachId: 'coach-1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };

const COACH = {
  id: 'coach-1',
  handle: 'maya-reyes',
  displayName: 'Maya Reyes',
  bio: null,
  avatarUrl: null,
  specialties: [] as string[],
  location: null,
  coachingMode: 'online' as const,
  timeZone: 'America/New_York',
  storefrontCompletedAt: null as Date | null,
  setupChecklistClosedAt: null as Date | null,
};

const VALID_BODY = {
  handle: 'maya-reyes',
  displayName: 'Maya Reyes',
  bio: 'Strength coach',
  avatarUrl: null,
  specialties: ['Strength'],
  location: 'Austin, TX',
  coachingMode: 'online',
  timeZone: 'America/Chicago',
};

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/coach/profile', { method: 'PATCH', body: JSON.stringify(body) });
}

function updateChain(returningResult: unknown[]) {
  const returning = jest.fn().mockResolvedValue(returningResult);
  const set = jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ returning }) });
  return { set };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/coach/profile', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('reports completed=false until the first save', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst: jest.fn().mockResolvedValue(COACH) } } });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { handle: 'maya-reyes', completed: false } });
  });

  it('reports completed=true once storefrontCompletedAt is set', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue({ ...COACH, storefrontCompletedAt: new Date() }) } },
    });

    const res = await GET();
    await expect(res.json()).resolves.toMatchObject({ data: { completed: true } });
  });

  it('reports setupChecklistClosedAt as null until the checklist has been closed', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({ query: { coaches: { findFirst: jest.fn().mockResolvedValue(COACH) } } });

    const res = await GET();
    await expect(res.json()).resolves.toMatchObject({ data: { setupChecklistClosedAt: null } });
  });

  it('reports setupChecklistClosedAt as an ISO string once the checklist has been closed', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const closedAt = new Date('2026-09-28T12:00:00.000Z');
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValue({ ...COACH, setupChecklistClosedAt: closedAt }) } },
    });

    const res = await GET();
    await expect(res.json()).resolves.toMatchObject({ data: { setupChecklistClosedAt: closedAt.toISOString() } });
  });
});

describe('PATCH /api/coach/profile', () => {
  it('returns 401 when not authenticated', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(patchRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('returns 422 with field errors for an invalid body', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const res = await PATCH(patchRequest({ ...VALID_BODY, specialties: [] }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.fields).toHaveProperty('specialties');
  });

  it('returns 409 HANDLE_TAKEN when another coach already has that handle', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    (getDb as jest.Mock).mockReturnValue({
      query: {
        coaches: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(COACH) // current coach lookup
            .mockResolvedValueOnce({ id: 'coach-2', handle: 'maya-reyes' }), // taken lookup
        },
      },
    });

    const res = await PATCH(patchRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe('HANDLE_TAKEN');
    expect(json.fields).toHaveProperty('handle');
  });

  it('saves the profile and sets storefrontCompletedAt on first save, without reissuing the session cookie when handle/name are unchanged', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const updated = { ...COACH, ...VALID_BODY, storefrontCompletedAt: new Date() };
    const update = jest.fn().mockReturnValue(updateChain([updated]));
    (getDb as jest.Mock).mockReturnValue({
      query: {
        coaches: {
          findFirst: jest.fn().mockResolvedValueOnce(COACH).mockResolvedValueOnce(undefined),
        },
      },
      update,
    });

    const res = await PATCH(patchRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(res.cookies.get('instar_session')).toBeUndefined();
    await expect(res.json()).resolves.toMatchObject({ data: { handle: 'maya-reyes', completed: true } });
  });

  it('reissues the session cookie when the handle changes', async () => {
    (requireCoachSession as jest.Mock).mockResolvedValue(SESSION);
    const updated = { ...COACH, ...VALID_BODY, handle: 'maya-new', storefrontCompletedAt: new Date() };
    const update = jest.fn().mockReturnValue(updateChain([updated]));
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockResolvedValueOnce(COACH).mockResolvedValueOnce(undefined) } },
      update,
    });

    const res = await PATCH(patchRequest({ ...VALID_BODY, handle: 'maya-new' }));

    expect(res.status).toBe(200);
    const cookie = res.cookies.get('instar_session');
    expect(cookie).toBeDefined();
    const session = await verifySessionToken(cookie!.value);
    expect(session).toMatchObject({ handle: 'maya-new' });
  });
});
