
import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import type { CustomField } from '@puckeditor/core';


export interface TextFieldValue {
  text: string;
  color: string;
  fontSize: number;

  fontFamily?: string;
}


export const FONT_FAMILY_PRESETS: { label: string; value: string }[] = [
  { label: 'Default (inherit)', value: '' },
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Inter', value: "Inter, sans-serif" },
  { label: 'Playfair Display (serif)', value: "'Playfair Display', serif" },
  { label: 'DM Serif Display (serif)', value: "'DM Serif Display', serif" },
  { label: 'Lora (serif)', value: "Lora, serif" },
  { label: 'Georgia (serif)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'System UI', value: "system-ui, -apple-system, sans-serif" },
];


export function getTextContent(
  value: string | TextFieldValue | undefined,
  fallback = '',
): string | ReactNode {
  if (!value) return fallback;
  if (typeof value === 'string') return value || fallback;
  return value.text || fallback;
}


export function getTextString(
  value: string | TextFieldValue | undefined,
  fallback = '',
): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value || fallback;
  return typeof value.text === 'string' ? (value.text || fallback) : fallback;
}


export function hasText(value: string | TextFieldValue | undefined): boolean {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value.text === 'string') return value.text.trim().length > 0;
  // The editor's inline-edit transform swaps the string `.text` for <InlineEditableSpan
  // text={original} />. Read the wrapped string so filled text stays visible while editing yet
  // an emptied field still hides hasText-gated elements (e.g. a CTA button).
  const inner = (value.text as { props?: { text?: unknown } } | null | undefined)?.props?.text;
  if (typeof inner === 'string') return inner.trim().length > 0;
  return value.text != null && value.text !== false;
}


export function scaledFontSize(px: number): string {
  return `calc(${px}px * var(--font-scale, 1))`;
}

export function getTextStyle(
  value: string | TextFieldValue | undefined,
  defaults?: { color?: string; fontSize?: number; fontFamily?: string },
): React.CSSProperties {
  if (!value || typeof value === 'string') {
    return {
      color: defaults?.color,
      fontSize: defaults?.fontSize ? scaledFontSize(defaults.fontSize) : undefined,
      fontFamily: defaults?.fontFamily,
    };
  }
  return {
    color: value.color || defaults?.color,
    fontSize: value.fontSize
      ? scaledFontSize(value.fontSize)
      : defaults?.fontSize
        ? scaledFontSize(defaults.fontSize)
        : undefined,
    fontFamily: value.fontFamily || defaults?.fontFamily,
  };
}


function TextFieldComponent({
  value,
  onChange,
  label,
  defaultColor,
  defaultFontSize,
}: {
  value: TextFieldValue;
  onChange: (v: TextFieldValue) => void;
  label?: string;
  defaultColor: string;
  defaultFontSize: number;
}) {
  const text = value?.text ?? '';
  const color = value?.color || defaultColor;
  const fontSize = value?.fontSize || defaultFontSize;

  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      )}

      <input
        type="text"
        value={text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder="Enter text…"
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          fontSize: 13,
          boxSizing: 'border-box',
          marginBottom: 8,
        }}
      />

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
          aria-label="Text color"
          title={color}
          style={{
            width: 28,
            height: 28,
            padding: 0,
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'none',
            flexShrink: 0,
          }}
        />
        <input
          type="number"
          value={fontSize}
          min={8}
          max={200}
          onChange={(e) =>
            onChange({ ...value, fontSize: Math.max(8, parseInt(e.target.value, 10) || defaultFontSize) })
          }
          aria-label="Font size in pixels"
          style={{
            width: 52,
            height: 28,
            padding: '0 6px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
            textAlign: 'center',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        />
        <FontChip value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function FontChip({
  value,
  onChange,
}: {
  value: TextFieldValue;
  onChange: (v: TextFieldValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const customized = Boolean(value.fontFamily);
  const presetMatch = FONT_FAMILY_PRESETS.find((p) => p.value === (value.fontFamily || ''));
  const currentLabel = customized
    ? (presetMatch?.label.replace(/\s*\(.*?\)\s*$/, '') ?? 'Custom')
    : 'Default';

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
    <div ref={rootRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Font: ${currentLabel}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          maxWidth: '100%',
          padding: '0 10px',
          fontSize: 12,
          fontWeight: 600,
          background: customized ? '#eef2ff' : '#ffffff',
          color: customized ? '#3730a3' : '#475569',
          border: `1px solid ${customized ? '#c7d2fe' : '#e2e8f0'}`,
          borderRadius: 6,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontFamily: value.fontFamily || 'inherit', fontWeight: 700, fontSize: 13 }}>A</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {currentLabel}
        </span>
        <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 'auto' }}>▾</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Font options"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 10,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
            padding: 10,
            width: 240,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <select
            value={
              FONT_FAMILY_PRESETS.some((p) => p.value === (value.fontFamily || ''))
                ? value.fontFamily || ''
                : '__custom__'
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__custom__') return;
              onChange({ ...value, fontFamily: v || undefined });
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 12,
              background: '#ffffff',
              boxSizing: 'border-box',
            }}
          >
            {FONT_FAMILY_PRESETS.map((p) => (
              <option key={p.value || 'default'} value={p.value}>
                {p.label}
              </option>
            ))}
            {value.fontFamily && !FONT_FAMILY_PRESETS.some((p) => p.value === value.fontFamily) && (
              <option value="__custom__">Custom…</option>
            )}
          </select>
          <input
            type="text"
            value={value.fontFamily || ''}
            placeholder="Custom CSS font-family"
            onChange={(e) => onChange({ ...value, fontFamily: e.target.value || undefined })}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 12,
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}
    </div>
  );
}


export function createTextField(options: {
  label?: string;
  defaultColor?: string;
  defaultFontSize?: number;
  inlineEditable?: boolean;
} = {}): CustomField<TextFieldValue> {
  const defaultColor = options.defaultColor || '#000000';
  const defaultFontSize = options.defaultFontSize || 16;
  const inlineEditable = options.inlineEditable !== false;

  return {
    type: 'custom',
    metadata: inlineEditable ? { autonnelEditable: true } : undefined,
    render: ({ value, onChange }) => {
      // Normalize legacy string values
      const normalized: TextFieldValue =
        typeof value === 'string'
          ? { text: value, color: defaultColor, fontSize: defaultFontSize }
          : value || { text: '', color: defaultColor, fontSize: defaultFontSize };

      return (
        <TextFieldComponent
          value={normalized}
          onChange={onChange}
          label={options.label}
          defaultColor={defaultColor}
          defaultFontSize={defaultFontSize}
        />
      );
    },
  };
}
