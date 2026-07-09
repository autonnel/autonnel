import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { CustomField } from '@puckeditor/core';

const STORAGE_KEY = 'autonnel-color-history';
const MAX_HISTORY = 16;
const HEX_COLOR_RE = /^#([0-9a-f]{3,8})$/i;
const NATIVE_COLOR_RE = /^#([0-9a-f]{6})$/i;

const PRESET_COLORS = [
  '#000000', '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#1e293b',
  '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db',
];

function isHexColor(value: string) {
  return HEX_COLOR_RE.test(value);
}

function normalizeColor(value: string) {
  return value.toLowerCase();
}

function previewColor(value: string) {
  if (!value) return 'transparent';
  return isHexColor(value) ? value : value;
}

function nativePickerValue(value: string) {
  return NATIVE_COLOR_RE.test(value) ? value : '#000000';
}

function readColorHistory(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function rememberColor(color: string) {
  try {
    const normalized = normalizeColor(color);
    const withoutCurrent = readColorHistory().filter((entry) => normalizeColor(entry) !== normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([normalized, ...withoutCurrent].slice(0, MAX_HISTORY)));
  } catch {

  }
}

function useColorHistory(open: boolean) {
  const [history, setHistory] = useState<string[]>([]);

  const refresh = useCallback(() => {
    setHistory(readColorHistory());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  return { history, refresh };
}

function useOutsideDismiss<T extends HTMLElement>(
  ref: React.RefObject<T>,
  active: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active) return;

    const closeOnOutsidePress = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onDismiss();
      }
    };

    document.addEventListener('mousedown', closeOnOutsidePress);
    return () => document.removeEventListener('mousedown', closeOnOutsidePress);
  }, [active, onDismiss, ref]);
}

const styles = {
  field: {
    marginBottom: '8px',
    position: 'relative',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '4px',
  },
  row: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  swatchTrigger: (color: string): CSSProperties => ({
    width: '32px',
    height: '32px',
    minWidth: '32px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    background: color,
    cursor: 'pointer',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
  }),
  textInput: {
    flex: 1,
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'monospace',
    boxSizing: 'border-box',
  },
  nativeInput: {
    width: '0',
    height: '0',
    padding: '0',
    border: 'none',
    visibility: 'hidden',
    position: 'absolute',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    padding: '10px',
    marginTop: '4px',
  },
  systemButton: {
    width: '100%',
    padding: '6px',
    marginBottom: '8px',
    background: '#f3f4f6',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#374151',
  },
  paletteTitle: {
    fontSize: '11px',
    color: '#9ca3af',
    marginBottom: '4px',
  },
  grid: (withBottomMargin: boolean): CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: '3px',
    marginBottom: withBottomMargin ? '8px' : undefined,
  }),
  swatch: (color: string, selected: boolean): CSSProperties => ({
    width: '100%',
    aspectRatio: '1',
    borderRadius: '4px',
    border: color === '#ffffff' ? '1px solid #d1d5db' : '1px solid transparent',
    background: color,
    cursor: 'pointer',
    outline: selected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '1px',
  }),
} satisfies Record<string, CSSProperties | ((...args: any[]) => CSSProperties)>;

function ColorSwatchGrid({
  colors,
  currentValue,
  withBottomMargin,
  onSelect,
}: {
  colors: string[];
  currentValue: string;
  withBottomMargin?: boolean;
  onSelect: (color: string) => void;
}) {
  const selectedValue = normalizeColor(currentValue || '');

  return (
    <div style={styles.grid(Boolean(withBottomMargin))}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          title={color}
          style={styles.swatch(color, selectedValue === color)}
        />
      ))}
    </div>
  );
}

function PaletteSection({
  title,
  colors,
  currentValue,
  withBottomMargin,
  onSelect,
}: {
  title: string;
  colors: string[];
  currentValue: string;
  withBottomMargin?: boolean;
  onSelect: (color: string) => void;
}) {
  if (colors.length === 0) return null;

  return (
    <>
      <div style={styles.paletteTitle}>{title}</div>
      <ColorSwatchGrid
        colors={colors}
        currentValue={currentValue}
        withBottomMargin={withBottomMargin}
        onSelect={onSelect}
      />
    </>
  );
}

function ColorPickerDropdown({
  value,
  history,
  nativeInputRef,
  onSelect,
}: {
  value: string;
  history: string[];
  nativeInputRef: React.RefObject<HTMLInputElement>;
  onSelect: (color: string) => void;
}) {
  return (
    <div style={styles.dropdown}>
      <button
        type="button"
        onClick={() => nativeInputRef.current?.click()}
        style={styles.systemButton}
      >
        Open System Color Picker
      </button>

      <PaletteSection
        title="Presets"
        colors={PRESET_COLORS}
        currentValue={value}
        withBottomMargin
        onSelect={onSelect}
      />

      <PaletteSection
        title="Recent"
        colors={history}
        currentValue={value}
        onSelect={onSelect}
      />
    </div>
  );
}

const ColorPickerComponent: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label?: string;
}> = ({ value, onChange, label }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const { history, refresh } = useColorHistory(showPicker);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const closePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  useOutsideDismiss(pickerRef, showPicker, closePicker);

  const handleColorSelect = useCallback((color: string) => {
    setInputValue(color);
    onChange(color);
    rememberColor(color);
    setShowPicker(false);
  }, [onChange]);

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    onChange(nextValue);
  };

  const handleTextBlur = () => {
    if (!inputValue || !isHexColor(inputValue)) return;
    rememberColor(inputValue);
    refresh();
  };

  return (
    <div style={styles.field} ref={pickerRef}>
      {label && <label style={styles.label}>{label}</label>}

      <div style={styles.row}>
        <button
          type="button"
          onClick={() => setShowPicker((open) => !open)}
          style={styles.swatchTrigger(previewColor(inputValue))}
          title="Open color picker"
        />

        <input
          type="text"
          value={inputValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder="#000000"
          style={styles.textInput}
        />

        <input
          ref={nativeInputRef}
          type="color"
          value={nativePickerValue(inputValue)}
          onChange={(event) => handleColorSelect(event.target.value)}
          style={styles.nativeInput}
        />
      </div>

      {showPicker && (
        <ColorPickerDropdown
          value={inputValue}
          history={history}
          nativeInputRef={nativeInputRef}
          onSelect={handleColorSelect}
        />
      )}
    </div>
  );
};

export function createColorField(options: {
  label?: string;
} = {}): CustomField<string | undefined> {
  return {
    type: 'custom',
    render: ({ value, onChange }) => (
      <ColorPickerComponent
        value={value || ''}
        onChange={onChange}
        label={options.label}
      />
    ),
  };
}

export { ColorPickerComponent };
