import { getDb } from '@/lib/commerce/db';
import { getStripe } from '@/lib/stripe/client';
import { findOwnDispute } from '@/lib/commerce/disputes';
import type { UploadEvidenceFileResponse } from '@/lib/commerce/types';
import { requireCoachSession } from '@/lib/auth/require-coach';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/** Sends a file (multipart/form-data, field name "file") to Stripe for use as dispute evidence,
 * and returns its file id — the coach's evidence save then references that id, it never holds the
 * file content itself. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCoachSession();
  if (!session) return apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);

  const { id } = await params;

  try {
    const db = getDb();
    const row = await findOwnDispute(db, session.coachId, id);
    if (!row) return apiError('NOT_FOUND', 'Dispute not found.', 404);

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return apiError('VALIDATION_ERROR', 'A file is required.', 422, { file: 'Choose a file to upload.' });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stripeFile = await getStripe().files.create({
      file: { data: buffer, name: file.name, type: file.type || 'application/octet-stream' },
      purpose: 'dispute_evidence',
    });

    return apiSuccess<UploadEvidenceFileResponse>({ fileId: stripeFile.id }, 'File uploaded.');
  } catch (err) {
    console.error(`POST /api/coach/disputes/${id}/files failed:`, err);
    return apiError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
  }
}
