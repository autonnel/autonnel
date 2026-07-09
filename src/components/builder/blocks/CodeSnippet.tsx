import React from 'react';
import { createColorField } from '../ColorField';

export interface CodeSnippetProps {
  label?: string;
  code: string;
  description?: string;
  terms?: string;
  borderStyle: 'solid' | 'dashed' | 'none';
  accentColor: string;
  backgroundColor?: string;
  showCopyButton: boolean;
}

export function CodeSnippet({
  label,
  code,
  description,
  terms,
  borderStyle = 'dashed',
  accentColor = '#f97316',
  backgroundColor,
  showCopyButton = true,
}: CodeSnippetProps) {
  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
  };

  return (
    <section style={{ backgroundColor, padding: '32px 16px', textAlign: 'center' }}>
      {label && <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12 }}>{label}</div>}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 24px',
          border: borderStyle === 'none' ? 'none' : `2px ${borderStyle} ${accentColor}`,
          borderRadius: 4,
          fontSize: 24,
          letterSpacing: '0.1em',
          color: accentColor,
          fontWeight: 700,
        }}
      >
        <span>{code}</span>
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy code"
            style={{
              border: 'none',
              background: 'transparent',
              color: accentColor,
              cursor: 'pointer',
              fontSize: 18,
              padding: 4,
            }}
          >
            Copy
          </button>
        )}
      </div>
      {description && <div style={{ marginTop: 12, fontSize: 14, color: '#6b7280' }}>{description}</div>}
      {terms && <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>{terms}</div>}
    </section>
  );
}

export const CodeSnippetConfig = {
  fields: {
    label: { type: 'text' as const, label: 'Label (above code)', contentEditable: true },
    code: { type: 'text' as const, label: 'Code' },
    description: { type: 'text' as const, label: 'Description', contentEditable: true },
    terms: { type: 'text' as const, label: 'Terms / fine print', contentEditable: true },
    borderStyle: {
      type: 'radio' as const,
      label: 'Border Style',
      options: [
        { label: 'Dashed', value: 'dashed' },
        { label: 'Solid', value: 'solid' },
        { label: 'None', value: 'none' },
      ],
    },
    accentColor: createColorField({ label: 'Accent Color' }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    showCopyButton: {
      type: 'radio' as const,
      label: 'Show Copy Button',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
  },
  defaultProps: {
    code: 'PROMO10',
    borderStyle: 'dashed',
    accentColor: '#f97316',
    showCopyButton: true,
  },
};

export default CodeSnippet;
