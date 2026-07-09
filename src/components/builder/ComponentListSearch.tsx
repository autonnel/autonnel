import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

type DrawerState = {
  drawer: HTMLElement;
  content: HTMLElement | null;
  category: HTMLElement | null;
};

function getDrawerState(container: HTMLElement): DrawerState[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-puck-drawer]')).map((drawer) => {
    const content = drawer.closest('[class*="ComponentList-content"]') as HTMLElement | null;
    return { drawer, content, category: content?.parentElement ?? null };
  });
}

function setDisplay(element: HTMLElement | null, display?: string) {
  if (!element) return;
  if (display === undefined) {
    element.style.removeProperty('display');
  } else {
    element.style.display = display;
  }
}

function applyComponentFilter(container: HTMLElement, rawQuery: string) {
  const query = rawQuery.toLowerCase().trim();
  const drawerStates = getDrawerState(container);

  for (const state of drawerStates) {
    let visibleCount = 0;

    for (const child of Array.from(state.drawer.children)) {
      const item = child as HTMLElement;
      const matches = !query || (item.textContent ?? '').toLowerCase().includes(query);
      setDisplay(item, matches ? undefined : 'none');
      if (matches) visibleCount += 1;
    }

    setDisplay(state.content, query && visibleCount === 0 ? 'none' : query ? 'block' : undefined);
    setDisplay(state.category, query && visibleCount === 0 ? 'none' : undefined);
  }
}

const shellStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const toolbarStyle: React.CSSProperties = {
  background: 'var(--puck-color-white, #fff)',
  borderBottom: '1px solid var(--puck-color-grey-09, #e2e8f0)',
  padding: '8px 12px',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};
const inputStyle: React.CSSProperties = {
  background: 'var(--puck-color-grey-12, #f8fafc)',
  border: '1px solid var(--puck-color-grey-09, #e2e8f0)',
  borderRadius: 6,
  boxSizing: 'border-box',
  color: 'inherit',
  fontSize: 13,
  outline: 'none',
  padding: '6px 28px',
  width: '100%',
};

export function ComponentListSearch({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSearch = search.length > 0;

  const iconStyle = useMemo<React.CSSProperties>(() => ({
    color: '#9ca3af',
    left: 8,
    pointerEvents: 'none',
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
  }), []);

  const filterVisibleDrawers = useCallback((query: string) => {
    if (containerRef.current) {
      applyComponentFilter(containerRef.current, query);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => filterVisibleDrawers(search), 50);
    return () => window.clearTimeout(timer);
  }, [children, filterVisibleDrawers, search]);

  return (
    <div data-autonnel-puck="component-list-search" style={shellStyle}>
      <div style={toolbarStyle}>
        <div style={{ position: 'relative' }}>
          <Search aria-hidden size={14} strokeWidth={2} style={iconStyle} />
          <input
            aria-label="Search components"
            onBlur={(event) => {
              event.currentTarget.style.background = 'var(--puck-color-grey-12, #f8fafc)';
              event.currentTarget.style.borderColor = 'var(--puck-color-grey-09, #e2e8f0)';
            }}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={(event) => {
              event.currentTarget.style.background = 'var(--puck-color-white, #fff)';
              event.currentTarget.style.borderColor = 'var(--puck-color-azure-04, #4f46e5)';
            }}
            placeholder="Search components..."
            style={inputStyle}
            type="text"
            value={search}
          />
          {hasSearch && (
            <button
              aria-label="Clear component search"
              onClick={() => setSearch('')}
              style={{
                alignItems: 'center',
                background: 'none',
                border: 0,
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                lineHeight: 1,
                padding: 4,
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
              type="button"
            >
              <X aria-hidden size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
