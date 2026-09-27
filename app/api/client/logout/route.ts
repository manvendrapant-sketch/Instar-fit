import { clearClientSessionCookie } from '@/lib/auth/clientSession';
import { apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

export async function POST() {
  const response = apiSuccess<null>(null, 'Logged out.');
  clearClientSessionCookie(response.cookies);
  return response;
}
