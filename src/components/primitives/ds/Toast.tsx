import * as React from 'react';

export type ToastTone = 'success' | 'error' | 'info' | 'warn';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  description?: string;
  createdAt: number;
  dismissible: boolean;
  autoDismissMs: number | null;
}

export interface ToastViewProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const TONE_STYLES: Record<ToastTone, { bar: string; icon: string; iconBg: string; iconPath: string }> = {
  success: {
    bar: 'border-l-ds-ok',
    icon: '#16A34A',
    iconBg: 'rgba(22,163,74,0.12)',
    iconPath: 'M5 12l4 4l10-10',
  },
  error: {
    bar: 'border-l-ds-bad',
    icon: '#DC2626',
    iconBg: 'rgba(220,38,38,0.12)',
    iconPath: 'M6 6l12 12M18 6l-12 12',
  },
  info: {
    bar: 'border-l-ds-accent',
    icon: '#2563EB',
    iconBg: 'rgba(37,99,235,0.12)',
    iconPath: 'M12 8v5M12 16.5h.01M12 21a9 9 0 1 1 0-18a9 9 0 0 1 0 18z',
  },
  warn: {
    bar: 'border-l-ds-warn',
    icon: '#D97706',
    iconBg: 'rgba(217,119,6,0.12)',
    iconPath: 'M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z',
  },
};

const Toast: React.FC<ToastViewProps> = ({ toast, onDismiss }) => {
  const tone = TONE_STYLES[toast.tone];
  return (
    <div
      role={toast.tone === 'error' || toast.tone === 'warn' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      className={`bg-ds-card border border-ds-line border-l-4 ${tone.bar} rounded-[10px] shadow-[0_4px_12px_rgba(17,24,39,.08)] w-[320px] px-4 py-3 flex items-start gap-3 pointer-events-auto animate-[toast-in_180ms_ease-out]`}
      style={{ animationFillMode: 'both' }}
    >
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
        style={{ backgroundColor: tone.iconBg }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke={tone.icon} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <path d={tone.iconPath} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ds-ink font-medium leading-snug break-words">{toast.message}</div>
        {toast.description && (
          <div className="text-[12px] text-ds-muted mt-0.5 break-words">{toast.description}</div>
        )}
      </div>
      {toast.dismissible && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 w-5 h-5 rounded-md text-ds-faint hover:text-ds-ink hover:bg-ds-surface2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
          aria-label="Dismiss notification"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Toast;
