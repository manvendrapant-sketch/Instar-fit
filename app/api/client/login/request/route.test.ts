import { POST } from './route';
import { getDb } from '@/lib/commerce/db';
import { sendMagicLinkEmail } from '@/lib/email/send';

jest.mock('@/lib/commerce/db');
jest.mock('@/lib/email/send');

function req(body: unknown) {
  return new Request('http://localhost/api/client/login/request', { method: 'POST', body: JSON.stringify(body) });
}

function mockDb(opts: { coach?: unknown; client?: unknown }) {
  const coachFindFirst = jest.fn().mockResolvedValue(opts.coach);
  const clientFindFirst = jest.fn().mockResolvedValue(opts.client);
  const insertValues = jest.fn().mockResolvedValue(undefined);
  const insert = jest.fn().mockReturnValue({ values: insertValues });
  (getDb as jest.Mock).mockReturnValue({
    query: { coaches: { findFirst: coachFindFirst }, clients: { findFirst: clientFindFirst } },
    insert,
  });
  return { insertValues };
}

const COACH = { id: 'coach-1', handle: 'maya-reyes', displayName: 'Maya Reyes' };
const CLIENT = { id: 'client-1', coachId: 'coach-1', email: 'client@example.com' };

beforeEach(() => jest.clearAllMocks());

describe('POST /api/client/login/request', () => {
  it('returns 400 on invalid JSON', async () => {
    const res = await POST(new Request('http://localhost/api/client/login/request', { method: 'POST', body: '{bad' }));
    expect(res.status).toBe(400);
  });

  it('returns 422 when handle or email is missing/invalid', async () => {
    const res = await POST(req({ handle: '', email: 'not-an-email' }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields).toEqual({ handle: 'handle is required.', email: 'Enter a valid email address.' });
  });

  it('returns the same generic success message when the coach does not exist', async () => {
    mockDb({ coach: undefined });
    const res = await POST(req({ handle: 'nobody', email: 'client@example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/if an account exists/i);
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it('returns the same generic success message when no client matches that coach+email', async () => {
    mockDb({ coach: COACH, client: undefined });
    const res = await POST(req({ handle: 'maya-reyes', email: 'stranger@example.com' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/if an account exists/i);
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it('stores a hashed token and emails the login link when a client matches', async () => {
    const { insertValues } = mockDb({ coach: COACH, client: CLIENT });
    (sendMagicLinkEmail as jest.Mock).mockResolvedValue(undefined);

    const res = await POST(req({ handle: 'MAYA-REYES', email: 'CLIENT@example.com' }));

    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'client-1', tokenHash: expect.any(String), expiresAt: expect.any(Date) }),
    );
    expect(sendMagicLinkEmail).toHaveBeenCalledWith('client@example.com', expect.stringContaining('/api/client/login/verify?token='), 'Maya Reyes');
  });

  it('still returns generic success if the email provider throws', async () => {
    mockDb({ coach: COACH, client: CLIENT });
    (sendMagicLinkEmail as jest.Mock).mockRejectedValue(new Error('provider down'));

    const res = await POST(req({ handle: 'maya-reyes', email: 'client@example.com' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/if an account exists/i);
  });

  it('returns 500 on a DB error', async () => {
    (getDb as jest.Mock).mockReturnValue({
      query: { coaches: { findFirst: jest.fn().mockRejectedValue(new Error('db down')) }, clients: { findFirst: jest.fn() } },
      insert: jest.fn(),
    });

    const res = await POST(req({ handle: 'maya-reyes', email: 'client@example.com' }));
    expect(res.status).toBe(500);
  });
});
