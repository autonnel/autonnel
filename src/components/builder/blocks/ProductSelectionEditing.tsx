import React from 'react';

type Glyph = { size: number };

const SVG_BASE = { viewBox: '0 0 24 24', fill: 'none' as const };

const haltBubbling = (ev: React.SyntheticEvent) => ev.stopPropagation();

const buttonReset = {
  background: 'none',
  border: 'none',
  padding: '1px',
  cursor: 'pointer',
  flexShrink: 0,
  lineHeight: 1,
  display: 'flex',
} as const;

function Tick({ size }: Glyph) {
  const pts = ['20 6', '9 17', '4 12'].join(' ');
  return (
    <svg width={size} height={size} {...SVG_BASE} stroke="white" strokeWidth="3">
      <polyline points={pts} />
    </svg>
  );
}

function Quill({ size }: Glyph) {
  const d = ['M17 3a2.83 2.83', '0 1 1 4 4L7.5', '20.5 2 22l1.5-5.5Z'].join(' ');
  return (
    <svg width={size} height={size} {...SVG_BASE} stroke="currentColor" strokeWidth="2">
      <path d={d} />
    </svg>
  );
}

function Revert({ size }: Glyph) {
  const arc = ['M3 12a9 9', '0 1 0 9-9 9.75', '9.75 0 0 0-6.74 2.74L3 8'].join(' ');
  return (
    <svg width={size} height={size} {...SVG_BASE} stroke="currentColor" strokeWidth="2">
      <path d={arc} />
      <path d="M3 3v5h5" />
    </svg>
  );
}

type InlineEditInputProps = {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  fontSize?: number;
  fontWeight?: number;
  iconSize?: number;
  buttonPadding?: string;
};

export function InlineEditInput(props: InlineEditInputProps) {
  const {
    value,
    onChange,
    onConfirm,
    onCancel,
    fontSize = 14,
    fontWeight,
    iconSize = 14,
    buttonPadding = '3px 6px',
  } = props;

  const wrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  };

  const fieldStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontSize,
    fontWeight,
    padding: '2px 6px',
    border: '1px solid #2563EB',
    borderRadius: 4,
    outline: 'none',
    color: '#111827',
  };

  const okStyle: React.CSSProperties = {
    background: '#2563EB',
    border: 'none',
    borderRadius: 4,
    padding: buttonPadding,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const leaveField = (ev: React.FocusEvent) => {
    const next = ev.relatedTarget as HTMLElement | null;
    if (!next?.dataset?.editConfirm) onConfirm();
  };

  const pressKey = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Enter') onConfirm();
    else if (ev.key === 'Escape') onCancel();
  };

  return (
    <div data-autonnel-puck="inline-edit" style={wrapStyle} onClick={haltBubbling}>
      <input
        autoFocus
        value={value}
        onChange={ev => onChange(ev.target.value)}
        onBlur={leaveField}
        onKeyDown={pressKey}
        style={fieldStyle}
      />
      <button data-edit-confirm="true" onClick={onConfirm} title="Confirm" style={okStyle}>
        <Tick size={iconSize} />
      </button>
    </div>
  );
}

type EditButtonProps = {
  onClick: () => void;
  size?: number;
  color?: string;
  title?: string;
};

export function EditButton(props: EditButtonProps) {
  const { onClick, size = 13, color = '#9ca3af', title = 'Edit name' } = props;

  const fire = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    onClick();
  };

  return (
    <button
      data-autonnel-puck="edit-button"
      onClick={fire}
      title={title}
      style={{ ...buttonReset, color }}
    >
      <Quill size={size} />
    </button>
  );
}

type ResetButtonProps = {
  onClick: () => void;
  size?: number;
};

export function ResetButton(props: ResetButtonProps) {
  const { onClick, size = 13 } = props;

  const fire = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    onClick();
  };

  return (
    <button
      data-autonnel-puck="reset-button"
      onClick={fire}
      title="Reset to original name"
      style={{ ...buttonReset, color: '#D97706' }}
    >
      <Revert size={size} />
    </button>
  );
}
