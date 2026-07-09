import type { CSSProperties } from 'react';

export const colors = {
  border: '#E5E7EB',
  input: '#D1D5DB',
  ink: '#111827',
  slate: '#4B5563',
  muted: '#6B7280',
  faint: '#9CA3AF',
  accent: '#2563EB',
  surface: '#FAFAFB',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#991B1B',
  amber: '#D97706',
  amberBg: '#FFF7ED',
  amberBorder: '#FED7AA',
  amberText: '#9A3412',
};

export const spinKeyframes = '@keyframes spin { to { transform: rotate(360deg); } }';

export const selectedTone = (active: boolean) => ({
  border: `1px solid ${active ? colors.accent : colors.border}`,
  background: active ? 'rgba(37, 99, 235, 0.04)' : 'white',
});

export const spinnerStyle = (size: number, stroke = 3): CSSProperties => ({
  width: size,
  height: size,
  border: `${stroke}px solid ${colors.border}`,
  borderTopColor: colors.accent,
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
});
