import React, { useEffect, useRef, useState } from 'react';
import { iconButtonStyle, spinnerStyle } from './styles';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  disabled: boolean;
}

export function ReferenceImage({ value, onChange, onUpload, uploading, disabled }: Props) {
  const [expanded, setExpanded] = useState(Boolean(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && !expanded) setExpanded(true);
  }, [value, expanded]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={{
          background: 'transparent',
          border: 0,
          color: '#4338ca',
          fontSize: 12,
          fontWeight: 500,
          padding: 0,
          cursor: 'pointer',
        }}
      >
        + Add reference image
      </button>
    );
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUpload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Reference image
        </span>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setExpanded(false);
            }}
            style={{ background: 'transparent', border: 0, color: '#6b7280', fontSize: 11, cursor: 'pointer', padding: 0 }}
          >
            Remove
          </button>
        )}
      </div>
      <input
        type="file"
        ref={inputRef}
        onChange={onFile}
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
      />
      {value ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <img
            src={value}
            alt="Reference"
            style={{
              width: 56,
              height: 56,
              objectFit: 'cover',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              flexShrink: 0,
            }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Reference image URL"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '6px 8px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 11,
              boxSizing: 'border-box',
              background: '#f9fafb',
              color: '#374151',
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste URL or click upload"
            style={{
              flex: 1,
              padding: '6px 8px',
              border: '1px dashed #d1d5db',
              borderRadius: 6,
              fontSize: 11,
              boxSizing: 'border-box',
              background: '#ffffff',
              color: '#374151',
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || disabled}
            style={iconButtonStyle(uploading || disabled)}
            aria-label="Upload reference image"
          >
            {uploading ? (
              <span style={spinnerStyle} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
