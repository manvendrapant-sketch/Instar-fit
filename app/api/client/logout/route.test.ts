import { POST } from './route';
import { CLIENT_SESSION_COOKIE_NAME } from '@/lib/auth/clientSession';

describe('POST /api/client/logout', () => {
  it('clears the client session cookie and returns success', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(CLIENT_SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe('');
  });
});
