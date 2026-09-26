'use client';

import { useAppState } from '@/lib/store';

export function Toast() {
  const { toastMessage } = useAppState();
  return (
    <div className={`ins-toast ${toastMessage ? 'show' : ''}`} role="status" aria-live="polite">
      {toastMessage}
    </div>
  );
}
