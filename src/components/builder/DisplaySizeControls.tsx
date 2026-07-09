import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { MediaFieldValue } from './MediaField';

export type DisplaySizeMode = 'original' | 'ratio' | 'custom';

export const ASPECT_RATIO_PRESETS = [
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:2', value: '3:2' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '3:4', value: '3:4' },
  { label: '2:3', value: '2:3' },
] as const;

const styles = {
  modeRow: {
    display: 'flex',
    gap: '6px',
    marginBottom: '8px',
  },
  modeButton: (active: boolean): React.CSSProperties => ({
    padding: '4px 8px',
    fontSize: '11px',
    border: '1px solid',
    borderColor: active ? '#4f46e5' : '#e2e8f0',
    borderRadius: '4px',
    background: active ? '#eef2ff' : 'white',
    color: active ? '#4f46e5' : '#6b7280',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }),
  ratioGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginBottom: '6px',
  },
  ratioButton: (active: boolean): React.CSSProperties => ({
    padding: '3px 8px',
    fontSize: '11px',
    border: '1px solid',
    borderColor: active ? '#4f46e5' : '#d1d5db',
    borderRadius: '12px',
    background: active ? '#eef2ff' : 'white',
    color: active ? '#4f46e5' : '#374151',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }),
  input: {
    width: '70px',
    padding: '4px 6px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    fontSize: '12px',
    textAlign: 'center',
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    color: '#6b7280',
  },
  separator: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  disclosure: (expanded: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#6b7280',
    padding: '2px 0',
    marginBottom: expanded ? '8px' : 0,
  }),
  chevron: (expanded: boolean): React.CSSProperties => ({
    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    transition: 'transform 0.15s',
  }),
  summary: {
    color: '#4f46e5',
    fontWeight: 500,
  },
  panel: {
    paddingLeft: '2px',
  },
} satisfies Record<string, React.CSSProperties | ((...args: any[]) => React.CSSProperties)>;

function currentMode(value: MediaFieldValue): DisplaySizeMode {
  return (value?.displaySizeMode || 'original') as DisplaySizeMode;
}

function normalizeDimension(value: string) {
  if (value === '') return '';
  return Number(value);
}

function isPresetRatio(ratio: string | undefined) {
  return ASPECT_RATIO_PRESETS.some((preset) => preset.value === ratio);
}

function sizeSummary(value: MediaFieldValue) {
  const mode = currentMode(value);
  if (mode === 'original') return '';
  if (mode === 'ratio') return ` · ${value.displayRatio || '1:1'}`;
  return ` · ${value.displayWidth || 'auto'}×${value.displayHeight || 'auto'}`;
}

export function getMediaDisplayStyle(media: MediaFieldValue | string | undefined): React.CSSProperties {
  if (!media || typeof media === 'string') return {};

  if (media.displaySizeMode === 'ratio' && media.displayRatio) {
    return {
      width: '100%',
      height: 'auto',
      aspectRatio: media.displayRatio.replace(':', '/'),
      objectFit: 'cover',
    };
  }

  if (media.displaySizeMode === 'custom') {
    return {
      objectFit: 'cover',
      width: typeof media.displayWidth === 'number' ? `${media.displayWidth}px` : 'auto',
      height: typeof media.displayHeight === 'number' ? `${media.displayHeight}px` : 'auto',
    };
  }

  return {};
}

function ModeSwitch({
  mode,
  value,
  onChange,
}: {
  mode: DisplaySizeMode;
  value: MediaFieldValue;
  onChange: (value: MediaFieldValue) => void;
}) {
  const activateMode = (nextMode: DisplaySizeMode) => {
    const nextValue = nextMode === 'ratio'
      ? { ...value, displaySizeMode: nextMode, displayRatio: value.displayRatio || '1:1' }
      : { ...value, displaySizeMode: nextMode };
    onChange(nextValue);
  };

  return (
    <div style={styles.modeRow}>
      {(['original', 'ratio', 'custom'] as const).map((option) => (
        <button
          key={option}
          style={styles.modeButton(mode === option)}
          onClick={() => activateMode(option)}
        >
          {option === 'original' ? 'Original' : option === 'ratio' ? 'Ratio' : 'Custom'}
        </button>
      ))}
    </div>
  );
}

function RatioOptions({
  value,
  onChange,
}: {
  value: MediaFieldValue;
  onChange: (value: MediaFieldValue) => void;
}) {
  const customRatio = isPresetRatio(value.displayRatio) ? '' : (value.displayRatio || '');

  return (
    <div style={styles.ratioGrid}>
      {ASPECT_RATIO_PRESETS.map((preset) => (
        <button
          key={preset.value}
          style={styles.ratioButton(value.displayRatio === preset.value)}
          onClick={() => onChange({ ...value, displayRatio: preset.value })}
        >
          {preset.label}
        </button>
      ))}
      <input
        type="text"
        value={customRatio}
        onChange={(event) => onChange({ ...value, displayRatio: event.target.value })}
        placeholder="W:H"
        style={{ ...styles.input, width: '50px', borderRadius: '12px' }}
      />
    </div>
  );
}

function DimensionInput({
  value,
  onChange,
}: {
  value: number | string | undefined;
  onChange: (value: number | '') => void;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(event) => onChange(normalizeDimension(event.target.value))}
      placeholder="auto"
      style={styles.input}
      min={0}
    />
  );
}

function CustomSizeOptions({
  value,
  onChange,
}: {
  value: MediaFieldValue;
  onChange: (value: MediaFieldValue) => void;
}) {
  return (
    <div style={styles.customRow}>
      <label style={styles.label}>W</label>
      <DimensionInput
        value={value.displayWidth}
        onChange={(displayWidth) => onChange({ ...value, displayWidth })}
      />
      <span style={styles.separator}>×</span>
      <label style={styles.label}>H</label>
      <DimensionInput
        value={value.displayHeight}
        onChange={(displayHeight) => onChange({ ...value, displayHeight })}
      />
      <span style={styles.separator}>px</span>
    </div>
  );
}

export function DisplaySizePanel({ value, onChange }: {
  value: MediaFieldValue;
  onChange: (v: MediaFieldValue) => void;
}) {
  const mode = currentMode(value);

  return (
    <div>
      <ModeSwitch mode={mode} value={value} onChange={onChange} />
      {mode === 'ratio' && <RatioOptions value={value} onChange={onChange} />}
      {mode === 'custom' && <CustomSizeOptions value={value} onChange={onChange} />}
    </div>
  );
}

export function DisplaySizeControls({ value, onChange }: {
  value: MediaFieldValue;
  onChange: (v: MediaFieldValue) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = sizeSummary(value);

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setExpanded((open) => !open)}
        style={styles.disclosure(expanded)}
      >
        <ChevronRight width={12} height={12} strokeWidth={2} style={styles.chevron(expanded)} />
        Display Size
        {summary && <span style={styles.summary}>{summary}</span>}
      </button>

      {expanded && (
        <div style={styles.panel}>
          <DisplaySizePanel value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
