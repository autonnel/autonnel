import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import type { CustomField } from '@puckeditor/core';

type URLKind = 'custom' | 'funnel-cta';

export interface URLFieldValue {
  type: URLKind;
  url: string;
}

const EMPTY_CUSTOM_URL: URLFieldValue = { type: 'custom', url: '' };

function normalizeURLFieldValue(value: URLFieldValue | string | undefined): URLFieldValue {
  if (typeof value === 'string') return { type: 'custom', url: value };
  return value || EMPTY_CUSTOM_URL;
}

function customURLValue(value: URLFieldValue) {
  return value.type === 'custom' ? value.url || '' : '';
}

function funnelRuntimeURL() {
  if (typeof window === 'undefined') return '';
  return (window as any).__FUNNEL_CTA_URL__ || (window as any).__FUNNEL_NEXT_STEP_URL__ || '';
}

const styles = {
  root: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '8px',
  },
  segmented: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    padding: '4px',
    background: '#f3f4f6',
    borderRadius: '6px',
  },
  segment: (active: boolean): CSSProperties => ({
    flex: 1,
    padding: '8px 12px',
    background: active ? 'white' : 'transparent',
    color: active ? '#1f2937' : '#6b7280',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
  }),
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
  },
  preview: {
    marginTop: '8px',
    padding: '8px 12px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#6b7280',
    wordBreak: 'break-all',
  },
  previewLabel: {
    fontWeight: 600,
    color: '#374151',
  },
} satisfies Record<string, CSSProperties | ((...args: any[]) => CSSProperties)>;

function ModeButton({
  mode,
  activeMode,
  children,
  onSelect,
}: {
  mode: URLKind;
  activeMode: URLKind;
  children: React.ReactNode;
  onSelect: (mode: URLKind) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      style={styles.segment(activeMode === mode)}
    >
      {children}
    </button>
  );
}

function URLModeSelector({
  value,
  onChange,
}: {
  value: URLKind;
  onChange: (mode: URLKind) => void;
}) {
  return (
    <div style={styles.segmented}>
      <ModeButton mode="custom" activeMode={value} onSelect={onChange}>
        Custom URL
      </ModeButton>
      <ModeButton mode="funnel-cta" activeMode={value} onSelect={onChange}>
        Funnel CTA Link
      </ModeButton>
    </div>
  );
}

function CustomURLInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={styles.input}
    />
  );
}

function URLPreview({ url }: { url: string }) {
  if (!url) return null;

  return (
    <div style={styles.preview}>
      <span style={styles.previewLabel}>URL:</span> {url}
    </div>
  );
}

export const URLFieldComponent: React.FC<{
  value: URLFieldValue | string;
  onChange: (value: URLFieldValue) => void;
  label?: string;
  placeholder?: string;
  showFunnelSelector?: boolean;
  pageId?: string;
}> = ({
  value,
  onChange,
  label,
  placeholder = 'Enter URL',
  showFunnelSelector = true,
}) => {
  const normalizedValue = normalizeURLFieldValue(value);
  const [urlType, setUrlType] = useState<URLKind>(normalizedValue.type);
  const [customUrl, setCustomUrl] = useState(customURLValue(normalizedValue));

  const selectURLType = (newType: URLKind) => {
    setUrlType(newType);
    onChange(newType === 'custom'
      ? { type: 'custom', url: customUrl }
      : { type: 'funnel-cta', url: '' });
  };

  const updateCustomURL = (newUrl: string) => {
    setCustomUrl(newUrl);
    onChange({ type: 'custom', url: newUrl });
  };

  return (
    <div style={styles.root}>
      {label && <label style={styles.label}>{label}</label>}

      {showFunnelSelector && (
        <URLModeSelector value={urlType} onChange={selectURLType} />
      )}

      {urlType === 'custom' && (
        <>
          <CustomURLInput
            value={customUrl}
            placeholder={placeholder}
            onChange={updateCustomURL}
          />
          <URLPreview url={customUrl} />
        </>
      )}
    </div>
  );
};

export function createURLField(options: {
  label?: string;
  placeholder?: string;
  showFunnelSelector?: boolean;
} = {}): CustomField<URLFieldValue> {
  return {
    type: 'custom',
    render: ({ value, onChange }) => {
      const normalizedValue = normalizeURLFieldValue(value);

      return (
        <URLFieldComponent
          value={normalizedValue}
          onChange={onChange}
          label={options.label}
          placeholder={options.placeholder}
          showFunnelSelector={options.showFunnelSelector !== false}
        />
      );
    },
  };
}

// Author-provided links end up in href attributes across all blocks; block
// javascript:/data:/other executable schemes (browsers strip control chars
// inside the scheme, so strip them before testing).
function sanitizeHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  const schemeProbe = trimmed.replace(/[\u0000-\u001f\u007f]/g, '');
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(schemeProbe);
  if (hasScheme && !/^(https?|mailto|tel):/i.test(schemeProbe)) return '';
  return trimmed;
}

export function getURLString(value: URLFieldValue | string | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return sanitizeHref(value);

  if (value.type === 'funnel-cta') {
    const resolvedURL = funnelRuntimeURL();
    if (resolvedURL) return resolvedURL;

    if (typeof window !== 'undefined') {
      console.warn('[Autonnel] Funnel CTA Link selected but __FUNNEL_CTA_URL__ is not set. Make sure page is in a funnel and has stepSlug configured.');
    }
  }

  return sanitizeHref(value.url || '');
}
