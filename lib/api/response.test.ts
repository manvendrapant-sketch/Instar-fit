import { apiError, apiSuccess } from '@/lib/api/response';

describe('apiSuccess', () => {
  it('returns a 200 by default with success:true and the given data/message', async () => {
    const res = apiSuccess({ coach: { id: '1' } }, 'Logged in successfully.');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: 'Logged in successfully.',
      data: { coach: { id: '1' } },
    });
  });

  it('honors an explicit status code (e.g. 201 for signup)', () => {
    const res = apiSuccess({ id: '1' }, 'Account created successfully.', 201);
    expect(res.status).toBe(201);
  });
});

describe('apiError', () => {
  it('returns success:false with the given code, message and status', async () => {
    const res = apiError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email or password.',
    });
  });

  it('omits the fields key entirely when no field errors are given', async () => {
    const res = apiError('NOT_AUTHENTICATED', 'You are not logged in.', 401);
    const body = await res.json();
    expect('fields' in body).toBe(false);
  });

  it('includes fields when field errors are given, for inline form errors', async () => {
    const res = apiError('VALIDATION_ERROR', 'Please fix the highlighted fields and try again.', 422, {
      email: 'Email is required.',
    });
    await expect(res.json()).resolves.toEqual({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Please fix the highlighted fields and try again.',
      fields: { email: 'Email is required.' },
    });
  });
});
