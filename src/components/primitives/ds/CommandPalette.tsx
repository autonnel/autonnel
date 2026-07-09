import * as React from 'react';
import {
  buildPaletteItems,
  filterAndRank,
  groupItems,
  nextIndex,
  type PaletteData,
  type PaletteItem,
} from './command-palette-helpers';

const PALETTE_OPEN_EVENT = 'autonnel:palette-open';

export function openCommandPalette() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT));
  }
}

function readPaletteData(): PaletteData {
  if (typeof window === 'undefined') return { funnels: [], sites: [] };
  const raw = (window as any).__AUTONNEL_PALETTE_DATA__;
  if (!raw || typeof raw !== 'object') return { funnels: [], sites: [] };
  return {
    funnels: Array.isArray(raw.funnels) ? raw.funnels : [],
    sites: Array.isArray(raw.sites) ? raw.sites : [],
  };
}

const KIND_LABEL: Record<PaletteItem['kind'], string> = {
  navigate: 'Page',
  funnel: 'Funnel',
  site: 'Site',
  order: 'Order',
  action: 'Action',
};

const CommandPalette: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const data = React.useMemo(readPaletteData, [open]);

  const flat = React.useMemo(() => filterAndRank(buildPaletteItems(data, query), query), [data, query]);
  const grouped = React.useMemo(() => groupItems(flat), [flat]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIdx(0);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isToggle) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
    };
  }, [open, close]);

  React.useEffect(() => {
    if (!open) return;
    previousFocus.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    setActiveIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open]);

  React.useEffect(() => {
    setActiveIdx((idx) => Math.min(idx, Math.max(0, flat.length - 1)));
  }, [flat.length]);

  const select = React.useCallback(
    (item: PaletteItem | undefined) => {
      if (!item || !item.href) return;
      close();
      if (typeof window === 'undefined') return;
      if (item.href === '/funnels?new=1' && window.location.pathname === '/funnels') {
        window.dispatchEvent(new CustomEvent('autonnel:new-funnel'));
        return;
      }
      window.location.assign(item.href);
    },
    [close],
  );

  const onListKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => nextIndex(i, flat.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => nextIndex(i, flat.length, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        select(flat[activeIdx]);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIdx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIdx(Math.max(0, flat.length - 1));
      }
    },
    [flat, activeIdx, select],
  );

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4" role="presentation">
      <style>{`
        @keyframes palette-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes palette-pop  { from { transform: translateY(-6px) scale(.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
      <div
        className="absolute inset-0 bg-[rgba(17,24,39,0.45)] backdrop-blur-sm"
        style={{ animation: 'palette-fade 140ms ease-out both' }}
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-[640px] bg-ds-card border border-ds-line rounded-[12px] shadow-[0_24px_64px_rgba(17,24,39,0.18)] overflow-hidden flex flex-col"
        style={{ animation: 'palette-pop 160ms ease-out both', maxHeight: 'calc(85vh - 15vh)' }}
        onKeyDown={onListKey}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ds-line">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 text-ds-muted shrink-0" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search funnels, sites, orders, actions…"
            className="flex-1 bg-transparent outline-none text-[14px] text-ds-ink placeholder:text-ds-muted"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="autonnel-palette-list"
            aria-activedescendant={flat[activeIdx]?.id}
          />
          <kbd className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-[5px] bg-ds-surface2 border border-ds-line text-ds-slate font-ds-mono text-[10.5px] leading-none">
            esc
          </kbd>
        </div>

        <div
          id="autonnel-palette-list"
          role="listbox"
          aria-label="Search results"
          className="flex-1 overflow-y-auto py-2"
        >
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-ds-muted">
              No matches for <span className="font-ds-mono tabular text-ds-slate">{query}</span>
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.group} className="pb-1">
                <div className="px-4 pt-2 pb-1 text-[10.5px] uppercase tracking-[0.06em] text-ds-faint font-medium">
                  {g.group}
                </div>
                {g.items.map((item) => {
                  runningIdx += 1;
                  const isActive = runningIdx === activeIdx;
                  const myIdx = runningIdx;
                  return (
                    <div
                      key={item.id}
                      id={item.id}
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIdx(myIdx)}
                      onClick={() => select(item)}
                      className={`mx-2 px-3 py-2 rounded-[7px] flex items-center gap-3 cursor-pointer text-[13.5px] ${
                        isActive ? 'bg-ds-surface2 text-ds-ink' : 'text-ds-slate hover:bg-ds-surface2'
                      }`}
                    >
                      <span className="text-[10.5px] uppercase tracking-[0.04em] text-ds-faint w-[52px] shrink-0">
                        {KIND_LABEL[item.kind]}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-ds-ink">{item.label}</span>
                      {item.hint && (
                        <span className="text-[11.5px] text-ds-muted font-ds-mono tabular truncate max-w-[220px]">
                          {item.hint}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-ds-line bg-ds-surface2 px-3 py-2 flex items-center gap-3 text-[11px] text-ds-muted">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-[4px] bg-ds-card border border-ds-line text-ds-slate font-ds-mono text-[10px] leading-none">↑</kbd>
            <kbd className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-[4px] bg-ds-card border border-ds-line text-ds-slate font-ds-mono text-[10px] leading-none">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-[28px] h-4 px-1 rounded-[4px] bg-ds-card border border-ds-line text-ds-slate font-ds-mono text-[10px] leading-none">enter</kbd>
            select
          </span>
          <span className="flex-1"></span>
          <span className="font-ds-mono tabular">{flat.length} results</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
