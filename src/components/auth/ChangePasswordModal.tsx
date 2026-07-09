import * as React from 'react';
import { toast } from '@/components/primitives/ds/ToastProvider';
import { apiCall, ApiCallError } from '@/lib/api/client';
import { Input, dsFieldLabelClass, dsFieldHintClass } from '@/components/primitives';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const firstFieldRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSubmitting(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit =
    currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await apiCall('POST /api/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed. Other sessions have been signed out.');
      onClose();
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.message || 'Failed to change password');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      className="fixed inset-0 z-40 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-[400px] max-w-[92vw] bg-ds-card border border-ds-line rounded-[10px] shadow-[0_12px_32px_rgba(17,24,39,0.18)] p-5">
        <h2
          id="change-password-title"
          className="text-[14px] font-semibold text-ds-ink mb-3"
        >
          Change password
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            inputRef={firstFieldRef}
            autoComplete="current-password"
          />
          <Field
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            hint="At least 8 characters"
          />
          <Field
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          {error && (
            <div role="alert" className="text-[12.5px] text-ds-bad">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-md border border-ds-line text-[12.5px] text-ds-slate hover:text-ds-ink hover:bg-ds-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-8 px-3 rounded-md bg-ds-ink text-ds-card text-[12.5px] font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
            >
              {submitting ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  autoComplete?: string;
  hint?: string;
}

function Field({ label, value, onChange, inputRef, autoComplete, hint }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className={dsFieldLabelClass}>{label}</span>
      <Input
        ref={inputRef}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {hint && <span className={dsFieldHintClass}>{hint}</span>}
    </label>
  );
}
