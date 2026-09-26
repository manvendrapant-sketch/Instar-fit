import 'server-only';
import { cache } from 'react';
import { loadPublicProfile } from '@/lib/publicStorefront';
import { requestOrigin } from '@/lib/publicOrigin';

/** One GET /api/coach/[handle] per request, shared by the page, its metadata and its share image. */
export const getPublicProfile = cache(async (handle: string) => loadPublicProfile(await requestOrigin(), handle));

export function normalizeParam(handle: string) {
  return decodeURIComponent(handle).toLowerCase();
}
