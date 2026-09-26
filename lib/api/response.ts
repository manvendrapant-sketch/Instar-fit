import { NextResponse } from 'next/server';

/**
 * The one response envelope every API route in this app returns, so the frontend can branch on
 * `success` alone and always has a human-readable `message` to show the user, regardless of
 * which endpoint it called.
 */
export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  /** Machine-readable, for the frontend to branch on (e.g. show a "resend verification" link). */
  code: string;
  /** Per-field validation messages, keyed by field name — for inline form errors. */
  fields?: Record<string, string>;
}

export function apiSuccess<T>(data: T, message: string, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, message, data }, { status });
}

export function apiError(code: string, message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json<ApiError>({ success: false, code, message, ...(fields ? { fields } : {}) }, { status });
}
