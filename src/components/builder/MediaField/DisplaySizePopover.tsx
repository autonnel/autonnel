import React, { useEffect, useRef, useState } from 'react';
import type { MediaFieldValue } from '../MediaField';
import { DisplaySizePanel } from '../DisplaySizeControls';

interface Props {
  value: MediaFieldValue;
  onChange: (v: MediaFieldValue) => void;
}

function chipLabel(value: MediaFieldValue): string {
  const mode = value?.displaySizeMode || 'original';
  if (mode === 'ratio' && value.displayRatio) return value.displayRatio;
  if (mode === 'custom') {
    const w = value.displayWidth || 'Auto';
    const h = value.displayHeight || 'Auto';
    return `${w}×${h}`;
  }
  return 'Auto';
}

export function DisplaySizePopover({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = chipLabel(value);
  const isCustomized = (value?.displaySizeMode || 'original') !== 'original';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Display size: ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          fontSize: 11,
          fontWeight: 600,
          background: isCustomized ? '#eef2ff' : 'rgba(255,255,255,0.92)',
          color: isCustomized ? '#3730a3' : '#475569',
          border: `1px solid ${isCustomized ? '#c7d2fe' : '#e2e8f0'}`,
          borderRadius: 999,
          boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
          cursor: 'pointer',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Display size options"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 10,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
            padding: 12,
            width: 260,
          }}
        >
          <DisplaySizePanel value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
