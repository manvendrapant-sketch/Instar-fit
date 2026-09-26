import { cookies } from 'next/headers';
import { clearSessionCookie } from '@/lib/auth/session';
import { apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export async function POST() {
  clearSessionCookie(await cookies());
  return apiSuccess(null, 'Logged out successfully.');
}
