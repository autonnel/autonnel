import * as React from 'react';
import { apiCall, ApiCallError } from '@/lib/api/client';
import { Input, Textarea } from '@/components/primitives';

interface FormState {
  name: string;
  description: string;
}

const INITIAL: FormState = { name: '', description: '' };

function readNewParam(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('new') === '1';
}

function clearNewParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('new')) return;
  url.searchParams.delete('new');
  const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash;
  window.history.replaceState(window.history.state, '', next);
}

export default function NewFunnelModal() {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openModal = React.useCallback(() => {
    setOpen(true);
    if (typeof window === 'undefined' || readNewParam()) return;
    const url = new URL(window.location.href);
    url.searchParams.set('new', '1');
    window.history.pushState(window.history.state, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  }, []);

  React.useEffect(() => {
    if (readNewParam()) setOpen(true);
    const onPop = () => setOpen(readNewParam());
    window.addEventListener('popstate', onPop);
    window.addEventListener('autonnel:new-funnel', openModal);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('autonnel:new-funnel', openModal);
    };
  }, [openModal]);

  const close = React.useCallback(() => {
    setOpen(false);
    setForm(INITIAL);
    setError(null);
    clearNewParam();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const funnel = await apiCall('POST /api/funnel', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      clearNewParam();
      if (funnel?.id) {
        window.location.href = `/funnel/${funnel.id}`;
      } else {
        window.location.href = '/funnels';
      }
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to create funnel');
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="new-funnel-title">
      <style>{`
        @keyframes new-funnel-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes new-funnel-pop  { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
      <div
        className="absolute inset-0 bg-[rgba(17,24,39,0.4)]"
        style={{ animation: 'new-funnel-fade 160ms ease-out both' }}
        onClick={close}
        aria-hidden="true"
      />
      <div
        className="relative bg-ds-card border border-ds-line rounded-[12px] shadow-[0_24px_64px_rgba(17,24,39,0.18)] w-[min(480px,calc(100vw-32px))]"
        style={{ animation: 'new-funnel-pop 200ms cubic-bezier(0.22,0.61,0.36,1) both' }}
      >
        <div className="px-5 pt-4 pb-3 border-b border-ds-line flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div id="new-funnel-title" className="text-[14px] font-semibold text-ds-ink">Create new funnel</div>
            <div className="text-[12.5px] text-ds-muted mt-0.5">Set up a funnel skeleton. You can wire up pages and ads from the funnel detail page.</div>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 w-7 h-7 rounded-md text-ds-slate hover:text-ds-ink hover:bg-ds-surface2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-5 py-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-ds-slate font-medium">Funnel name</span>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Holiday Promo Funnel"
              autoFocus
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-ds-slate font-medium">Description (optional)</span>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What is this funnel for?"
              rows={3}
              className="resize-none"
            />
          </label>

          {error && (
            <div className="text-[12.5px] text-[#B91C1C] bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.2)] rounded-[6px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink border border-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating…' : 'Create funnel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
