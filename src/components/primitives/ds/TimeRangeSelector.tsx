import * as React from 'react';

type RangeValue = '24h' | '7d' | '30d';

interface RangeOption {
  value: RangeValue;
  label: string;
}

const OPTIONS: RangeOption[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

interface Props {
  current?: RangeValue;
}

function isRangeValue(v: string | null): v is RangeValue {
  return v === '24h' || v === '7d' || v === '30d';
}

export default function TimeRangeSelector({ current = '24h' }: Props) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<RangeValue>(current);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('range');
    if (isRangeValue(fromUrl)) setActive(fromUrl);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const select = (val: RangeValue) => {
    setActive(val);
    setOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('range', val);
    window.location.href = url.pathname + '?' + url.searchParams.toString() + url.hash;
  };

  const activeLabel = OPTIONS.find((o) => o.value === active)?.label ?? OPTIONS[0].label;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] gap-2 bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
      >
        {activeLabel}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3 text-ds-muted" aria-hidden="true">
          <path d="M4 6l4 4l4-4" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 z-30 w-44 bg-ds-card border border-ds-line rounded-[8px] shadow-[0_8px_24px_rgba(17,24,39,0.12)] py-1"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === active}
              onClick={() => select(opt.value)}
              className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-ds-surface2 ${opt.value === active ? 'text-ds-ink font-medium' : 'text-ds-slate'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
