import * as React from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = 'w-full sm:w-full lg:w-[480px]',
  closeOnBackdrop = true,
  closeOnEscape = true,
}) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    previousFocus.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    }
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose, closeOnEscape]);

  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55]" aria-hidden={!open}>
      <style>{`
        @keyframes drawer-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0);    }
        }
        @keyframes drawer-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      <div
        className="absolute inset-0 bg-[rgba(17,24,39,0.4)]"
        style={{ animation: 'drawer-fade 160ms ease-out both' }}
        onClick={() => closeOnBackdrop && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`absolute right-0 top-0 bottom-0 ${widthClass} bg-ds-card border-l border-ds-line shadow-[-4px_0_24px_rgba(17,24,39,0.08)] flex flex-col focus:outline-none`}
        style={{ animation: 'drawer-in 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both' }}
      >
        {(title !== undefined || subtitle !== undefined) && (
          <div className="px-5 py-4 border-b border-ds-line flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              {title !== undefined && (
                <div id={titleId} className="text-[14px] font-semibold text-ds-ink truncate">
                  {title}
                </div>
              )}
              {subtitle !== undefined && (
                <div className="text-[12.5px] text-ds-muted mt-0.5 truncate">{subtitle}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-7 h-7 rounded-md text-ds-slate hover:text-ds-ink hover:bg-ds-surface2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
              aria-label="Close panel"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
        {footer !== undefined && (
          <div className="px-5 py-3 border-t border-ds-line bg-ds-surface2 shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drawer;
