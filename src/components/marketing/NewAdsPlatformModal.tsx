import * as React from 'react';
import { Input, dsSelectClass } from '@/components/primitives';
import { cn } from '@/lib/utils';

interface PlatformField {
  key: string;
  label: string;
  placeholder?: string;
}

interface Platform {
  id: string;
  label: string;
  mode: 'token' | 'oauth';
  fields?: PlatformField[];
  oauthAuthorizeUrl?: string;
}

interface NewAdsPlatformModalProps {
  platforms: Platform[];
}

const OPEN_EVENT = 'autonnel:ads-new-open';

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

export default function NewAdsPlatformModal({ platforms }: NewAdsPlatformModalProps) {
  const firstId = platforms[0]?.id ?? '';
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [platformId, setPlatformId] = React.useState<string>(firstId);
  const [credentials, setCredentials] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (readNewParam()) setOpen(true);
    const onPop = () => setOpen(readNewParam());
    const onOpen = () => setOpen(true);
    window.addEventListener('popstate', onPop);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    setName('');
    setPlatformId(firstId);
    setCredentials({});
    setError(null);
    clearNewParam();
  }, [firstId]);

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

  const def = platforms.find((p) => p.id === platformId) ?? platforms[0];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !def) return;
    if (def.mode === 'oauth') {
      if (!def.oauthAuthorizeUrl) {
        setError('OAuth authorize URL is missing for this platform');
        return;
      }
      window.location.href = def.oauthAuthorizeUrl;
      return;
    }
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    const fields = def.fields ?? [];
    const missing = fields.filter((f) => !credentials[f.key]?.trim()).map((f) => f.label);
    if (missing.length > 0) {
      setError(`Missing: ${missing.join(', ')}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          platform: def.id,
          credentials,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j?.error || 'Failed to create ad platform');
      }
      const created = (await res.json()) as { id?: string };
      clearNewParam();
      if (created?.id) {
        window.location.href = `/marketing/${created.id}`;
      } else {
        window.location.href = '/marketing';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ad platform');
      setSubmitting(false);
    }
  };

  if (!open || !def) return null;

  const isOAuth = def.mode === 'oauth';
  const fields = def.fields ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="new-ads-title">
      <style>{`
        @keyframes new-ads-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes new-ads-pop  { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
      <div
        className="absolute inset-0 bg-[rgba(17,24,39,0.4)]"
        style={{ animation: 'new-ads-fade 160ms ease-out both' }}
        onClick={close}
        aria-hidden="true"
      />
      <div
        className="relative bg-ds-card border border-ds-line rounded-[12px] shadow-[0_24px_64px_rgba(17,24,39,0.18)] w-[min(520px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto"
        style={{ animation: 'new-ads-pop 200ms cubic-bezier(0.22,0.61,0.36,1) both' }}
      >
        <div className="px-5 pt-4 pb-3 border-b border-ds-line flex items-start justify-between gap-3 sticky top-0 bg-ds-card">
          <div className="min-w-0">
            <div id="new-ads-title" className="text-[14px] font-semibold text-ds-ink">Connect ad platform</div>
            <div className="text-[12.5px] text-ds-muted mt-0.5">Pick a platform and provide credentials, or connect via OAuth where supported.</div>
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
          {!isOAuth && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ds-slate font-medium">Connection name</span>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Facebook Pixel"
                autoFocus
                required
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-ds-slate font-medium">Platform</span>
            <select
              value={platformId}
              onChange={(e) => {
                setPlatformId(e.target.value);
                setCredentials({});
                setError(null);
              }}
              className={cn(dsSelectClass)}
            >
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>

          {!isOAuth && fields.map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5">
              <span className="text-[12px] text-ds-slate font-medium">{field.label}</span>
              <Input
                type="text"
                value={credentials[field.key] ?? ''}
                onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="font-ds-mono tabular"
                required
              />
            </label>
          ))}

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
              {isOAuth ? `Connect with ${def.label}` : (submitting ? 'Connecting…' : 'Connect platform')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
