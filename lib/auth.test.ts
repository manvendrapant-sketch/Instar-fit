import {
  hasErrors,
  initialsFor,
  login,
  logout,
  readLogin,
  readSignup,
  signup,
  validateLogin,
  validateSignup,
} from '@/lib/auth';

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe('readSignup', () => {
  it('trims name/email, lowercases email, and reads the terms checkbox', () => {
    const values = readSignup(
      formData({ name: '  Maya Reyes  ', email: '  Maya@Studio.com  ', password: 'supersecret1', confirm: 'supersecret1', terms: 'on' }),
    );
    expect(values).toEqual({
      name: 'Maya Reyes',
      email: 'maya@studio.com',
      password: 'supersecret1',
      confirm: 'supersecret1',
      terms: true,
    });
  });

  it('reads an unchecked terms checkbox as false (absent from FormData)', () => {
    const values = readSignup(formData({ name: 'Maya', email: 'maya@studio.com', password: 'x', confirm: 'x' }));
    expect(values.terms).toBe(false);
  });
});

describe('readLogin', () => {
  it('trims and lowercases the email, leaves password untouched', () => {
    const values = readLogin(formData({ email: '  Maya@Studio.com  ', password: ' supersecret1 ' }));
    expect(values).toEqual({ email: 'maya@studio.com', password: ' supersecret1 ' });
  });
});

describe('validateSignup', () => {
  const valid = { name: 'Maya Reyes', email: 'maya@studio.com', password: 'supersecret1', confirm: 'supersecret1', terms: true };

  it('has no errors for a fully valid form', () => {
    expect(validateSignup(valid)).toEqual({});
  });

  it('requires a name', () => {
    expect(validateSignup({ ...valid, name: '' }).name).toBeDefined();
  });

  it('requires a plausible email', () => {
    expect(validateSignup({ ...valid, email: 'not-an-email' }).email).toBeDefined();
  });

  it('requires at least 8 characters for the password', () => {
    expect(validateSignup({ ...valid, password: 'short1' }).password).toBeDefined();
  });

  it('requires the confirm field', () => {
    expect(validateSignup({ ...valid, confirm: '' }).confirm).toBeDefined();
  });

  it('requires confirm to match password', () => {
    expect(validateSignup({ ...valid, confirm: 'somethingElse1' }).confirm).toBeDefined();
  });

  it('requires the terms checkbox', () => {
    expect(validateSignup({ ...valid, terms: false }).terms).toBeDefined();
  });
});

describe('validateLogin', () => {
  it('has no errors for a plausible email and any non-empty password', () => {
    expect(validateLogin({ email: 'maya@studio.com', password: 'x' })).toEqual({});
  });

  it('requires a plausible email', () => {
    expect(validateLogin({ email: 'not-an-email', password: 'x' }).email).toBeDefined();
  });

  it('requires a password', () => {
    expect(validateLogin({ email: 'maya@studio.com', password: '' }).password).toBeDefined();
  });
});

describe('hasErrors', () => {
  it('is false for an empty object', () => {
    expect(hasErrors({})).toBe(false);
  });

  it('is true once any key is present', () => {
    expect(hasErrors({ email: 'bad' })).toBe(true);
  });
});

describe('initialsFor', () => {
  it('takes the first letter of the first and last word', () => {
    expect(initialsFor('Maya Reyes')).toBe('MR');
  });

  it('handles a single-word name', () => {
    expect(initialsFor('Maya')).toBe('M');
  });

  it('handles extra whitespace and a middle name', () => {
    expect(initialsFor('  Maya   Jane Reyes  ')).toBe('MR');
  });

  it('returns an empty string for an empty name', () => {
    expect(initialsFor('')).toBe('');
  });
});

describe('signup / login / logout (fetch wrappers)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchJson(body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve(body) }) as typeof fetch;
  }

  it('signup() posts displayName (not "name") and email/password to /api/auth/signup', async () => {
    mockFetchJson({ success: true, message: 'Account created successfully.', data: { coach: { id: '1' } } });
    await signup({ name: 'Maya Reyes', email: 'maya@studio.com', password: 'supersecret1', confirm: 'supersecret1', terms: true });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/signup',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'maya@studio.com', password: 'supersecret1', displayName: 'Maya Reyes' }),
      }),
    );
  });

  it('signup() returns ok:true with the coach on success', async () => {
    const coach = { id: '1', email: 'maya@studio.com', handle: 'maya-reyes', displayName: 'Maya Reyes' };
    mockFetchJson({ success: true, message: 'Account created successfully.', data: { coach } });
    const result = await signup({ name: 'Maya Reyes', email: 'maya@studio.com', password: 'x', confirm: 'x', terms: true });
    expect(result).toEqual({ ok: true, coach });
  });

  it('signup() maps the backend\'s "displayName" field error onto "name"', async () => {
    mockFetchJson({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Please fix the highlighted fields and try again.',
      fields: { displayName: 'Name is required.' },
    });
    const result = await signup({ name: '', email: 'maya@studio.com', password: 'x', confirm: 'x', terms: true });
    expect(result).toEqual({
      ok: false,
      message: 'Please fix the highlighted fields and try again.',
      fieldErrors: { name: 'Name is required.' },
    });
  });

  it('signup() returns an empty fieldErrors object for a general (non-field) error', async () => {
    mockFetchJson({ success: false, code: 'EMAIL_OR_HANDLE_TAKEN', message: 'Please try again.' });
    const result = await signup({ name: 'Maya', email: 'maya@studio.com', password: 'x', confirm: 'x', terms: true });
    expect(result).toEqual({ ok: false, message: 'Please try again.', fieldErrors: {} });
  });

  it('login() posts email/password as-is to /api/auth/login', async () => {
    mockFetchJson({ success: true, message: 'Logged in successfully.', data: { coach: { id: '1' } } });
    await login({ email: 'maya@studio.com', password: 'supersecret1' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ body: JSON.stringify({ email: 'maya@studio.com', password: 'supersecret1' }) }),
    );
  });

  it('login() returns ok:false with an empty fieldErrors for invalid credentials (no fields from the backend)', async () => {
    mockFetchJson({ success: false, code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' });
    const result = await login({ email: 'maya@studio.com', password: 'wrong' });
    expect(result).toEqual({ ok: false, message: 'Incorrect email or password.', fieldErrors: {} });
  });

  it('logout() posts to /api/auth/logout', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({}) }) as typeof fetch;
    await logout();
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  });
});
