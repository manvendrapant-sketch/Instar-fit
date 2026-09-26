import { validateLoginInput, validateSignupInput } from '@/lib/auth/validation';

describe('validateSignupInput', () => {
  const validBody = { email: 'Maya@Studio.com', password: 'supersecret1', displayName: '  Maya Reyes  ' };

  it('accepts a well-formed body and normalizes email/displayName', () => {
    const result = validateSignupInput(validBody);
    expect(result).toEqual({
      value: { email: 'maya@studio.com', password: 'supersecret1', displayName: 'Maya Reyes' },
    });
  });

  it('never has a handle field — the backend derives it, the signup form never sends one', () => {
    const result = validateSignupInput(validBody);
    expect('value' in result && (result.value as unknown as Record<string, unknown>).handle).toBeUndefined();
  });

  it('rejects a missing email', () => {
    const result = validateSignupInput({ ...validBody, email: undefined });
    expect(result).toEqual({ errors: { email: 'Email is required.' } });
  });

  it('rejects a malformed email', () => {
    const result = validateSignupInput({ ...validBody, email: 'not-an-email' });
    expect(result).toEqual({ errors: { email: 'Enter a valid email address.' } });
  });

  it('rejects a missing password', () => {
    const result = validateSignupInput({ ...validBody, password: undefined });
    expect(result).toEqual({ errors: { password: 'Password is required.' } });
  });

  it('rejects a password under 8 characters', () => {
    const result = validateSignupInput({ ...validBody, password: 'short1' });
    expect(result).toEqual({ errors: { password: 'Password must be at least 8 characters.' } });
  });

  it('rejects a missing displayName', () => {
    const result = validateSignupInput({ ...validBody, displayName: '   ' });
    expect(result).toEqual({ errors: { displayName: 'Name is required.' } });
  });

  it('reports every invalid field at once, not just the first', () => {
    const result = validateSignupInput({});
    expect(result).toEqual({
      errors: {
        email: 'Email is required.',
        password: 'Password is required.',
        displayName: 'Name is required.',
      },
    });
  });

  it('tolerates a non-object body instead of throwing', () => {
    expect(() => validateSignupInput(null)).not.toThrow();
    expect(() => validateSignupInput('a string')).not.toThrow();
    expect(() => validateSignupInput(42)).not.toThrow();
  });

  it('rejects non-string field values rather than coercing them', () => {
    const result = validateSignupInput({ email: 123, password: true, displayName: [] });
    expect(result).toEqual({
      errors: {
        email: 'Email is required.',
        password: 'Password is required.',
        displayName: 'Name is required.',
      },
    });
  });
});

describe('validateLoginInput', () => {
  it('accepts a well-formed body and normalizes email', () => {
    const result = validateLoginInput({ email: 'Maya@Studio.com', password: 'anything' });
    expect(result).toEqual({ value: { email: 'maya@studio.com', password: 'anything' } });
  });

  it('does not enforce a minimum password length (that is a signup-only rule)', () => {
    const result = validateLoginInput({ email: 'maya@studio.com', password: 'x' });
    expect(result).toEqual({ value: { email: 'maya@studio.com', password: 'x' } });
  });

  it('rejects a missing email and password together', () => {
    const result = validateLoginInput({});
    expect(result).toEqual({
      errors: { email: 'Email is required.', password: 'Password is required.' },
    });
  });
});
