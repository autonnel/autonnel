import type React from 'react';

export const SPIN_KEYFRAMES = `@keyframes mediaSpin { to { transform: rotate(360deg); } }`;

export const spinnerStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  border: '2px solid #c7d2fe',
  borderTopColor: '#4338ca',
  borderRadius: '50%',
  animation: 'mediaSpin 1s linear infinite',
};

export function iconButtonStyle(disabled: boolean, active = false): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    padding: 0,
    background: disabled ? '#f3f4f6' : active ? '#4f46e5' : '#eef2ff',
    color: disabled ? '#9ca3af' : active ? '#ffffff' : '#3730a3',
    border: `1px solid ${disabled ? '#e5e7eb' : active ? '#4338ca' : '#c7d2fe'}`,
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    transition: 'background 120ms, border-color 120ms',
  };
}
