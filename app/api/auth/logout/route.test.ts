import { cookies } from 'next/headers';
import { POST } from '@/app/api/auth/logout/route';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';

jest.mock('next/headers');

describe('POST /api/auth/logout', () => {
  it('clears the session cookie and returns a success message', async () => {
    const set = jest.fn();
    (cookies as jest.Mock).mockResolvedValue({ set });

    const res = await POST();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: 'Logged out successfully.',
      data: null,
    });
    expect(set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      '',
      expect.objectContaining({ maxAge: 0, httpOnly: true }),
    );
  });
});
