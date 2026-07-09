import { useState, useRef, useEffect } from 'react';
import { ICON_PREVIEW } from './icons';

interface PreviewDropdownProps {
  slug: string;
  canDiscard?: boolean;
  discarding?: boolean;
  onDiscard?: () => void;
}

export function PreviewDropdown({ slug, canDiscard = false, discarding = false, onDiscard }: PreviewDropdownProps) {
  const [open, setOpen] = useState(false);
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/settings/domains')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ domain: string; isPrimary: boolean }>;
        if (!alive) return;
        const primary = data.find((d) => d.isPrimary) ?? data[0];
        setPrimaryDomain(primary?.domain ?? null);
      })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const previewPath = slug === '/' ? '' : slug.replace(/^\//, '');
  const previewUrl = `/preview/${previewPath}`;
  const storefrontUrl = primaryDomain
    ? slug === '/'
      ? `https://${primaryDomain}/`
      : `https://${primaryDomain}/${slug.replace(/^\//, '')}`
    : null;

  const openPreview = () => { window.open(previewUrl, '_blank'); setOpen(false); };
  const openStorefront = () => {
    if (!storefrontUrl) return;
    window.open(storefrontUrl, '_blank');
    setOpen(false);
  };
  const discard = () => {
    setOpen(false);
    onDiscard?.();
  };

  const storefrontTitle = !loaded
    ? 'Loading domains…'
    : !storefrontUrl
    ? 'Bind a domain first in Settings → Domains'
    : storefrontUrl;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[7px] text-[12px] font-medium border border-ds-line bg-ds-card text-ds-ink hover:bg-[#F9FAFB]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {ICON_PREVIEW}
        Preview
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-60 bg-ds-card border border-ds-line rounded-[7px] shadow-[0_10px_30px_rgba(17,24,39,.12)] z-50 py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={openPreview}
            className="w-full text-left px-3 py-2 text-[12.5px] text-ds-ink hover:bg-[#F9FAFB]"
          >
            <div className="font-medium">Preview</div>
            <div className="text-[11px] text-ds-muted truncate">{previewUrl}</div>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={openStorefront}
            disabled={!storefrontUrl}
            title={storefrontTitle}
            className={`w-full text-left px-3 py-2 text-[12.5px] ${
              storefrontUrl ? 'text-ds-ink hover:bg-[#F9FAFB]' : 'text-ds-faint cursor-not-allowed'
            }`}
          >
            <div className="font-medium">Storefront view</div>
            <div className="text-[11px] text-ds-muted truncate">
              {storefrontUrl ?? 'Bind a domain first'}
            </div>
          </button>
          {onDiscard && (
            <>
              <div role="separator" className="my-1 border-t border-ds-line" />
              <button
                type="button"
                role="menuitem"
                onClick={discard}
                disabled={!canDiscard || discarding}
                title={
                  canDiscard
                    ? 'Revert the draft to the last published version'
                    : 'No unpublished changes to discard'
                }
                className={`w-full text-left px-3 py-2 text-[12.5px] ${
                  canDiscard && !discarding
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-ds-faint cursor-not-allowed'
                }`}
              >
                <div className="font-medium">
                  {discarding ? 'Discarding…' : 'Discard unpublished changes'}
                </div>
                <div className="text-[11px] text-ds-muted truncate">
                  Revert to the published version
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
