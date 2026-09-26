'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '@/lib/icons';

// Shared pill fields for the signed-out forms (sign up, log in).

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="ins-field-err" id={id} role="alert">
      {message}
    </span>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  name: string;
  label: string;
  icon: IconName;
  error?: string;
  hint?: ReactNode;
}

export function TextField({ name, label, icon, error, hint, ...input }: TextFieldProps) {
  const errId = `${name}-err`;
  const hintId = `${name}-hint`;
  return (
    <label className="ins-field">
      <span className="ins-field-l">{label}</span>
      <span className={`ins-input ${error ? 'bad' : ''}`}>
        <Icon name={icon} />
        <input name={name} aria-invalid={!!error} aria-describedby={error ? errId : hint ? hintId : undefined} {...input} />
      </span>
      {error ? (
        <FieldError id={errId} message={error} />
      ) : (
        hint && (
          <span className="ins-field-hint" id={hintId}>
            {hint}
          </span>
        )
      )}
    </label>
  );
}

interface PasswordFieldProps {
  name: string;
  label: string;
  error?: string;
  autoComplete: 'new-password' | 'current-password';
  placeholder?: string;
}

export function PasswordField({ name, label, error, autoComplete, placeholder }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const errId = `${name}-err`;
  return (
    <label className="ins-field">
      <span className="ins-field-l">{label}</span>
      <span className={`ins-input ${error ? 'bad' : ''}`}>
        <Icon name="lock" />
        <input
          name={name}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          required
        />
        <button
          type="button"
          className="ins-input-btn"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
        >
          <Icon name={shown ? 'eyeoff' : 'eye'} />
        </button>
      </span>
      <FieldError id={errId} message={error} />
    </label>
  );
}
