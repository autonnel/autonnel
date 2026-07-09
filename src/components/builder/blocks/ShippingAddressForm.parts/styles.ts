import React from 'react';
import { scaledFontSize } from '../../TextField';

export interface FormStyles {
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  errorMsgStyle: React.CSSProperties;
}

export interface FieldStyleOptions {
  radius?: number;
  height?: number;
  fieldBackground?: string;
  textColor?: string;
  labelColor?: string;
}

export function buildStyles(borderColor: string, opts: FieldStyleOptions = {}): FormStyles {
  const { radius = 4, height, fieldBackground = 'white', textColor = '#333333', labelColor = '#333333' } = opts;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: height ? '0 14px' : '8px 10px',
    height: height || undefined,
    borderRadius: radius,
    border: '1px solid ' + borderColor,
    fontSize: scaledFontSize(14),
    fontFamily: 'inherit',
    color: textColor,
    background: fieldBackground,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: scaledFontSize(13),
    fontWeight: 'var(--autonnel-label-fw, 700)' as unknown as number,
    color: labelColor,
    marginBottom: 4,
  };

  const errorMsgStyle: React.CSSProperties = {
    color: '#ef4444',
    fontSize: scaledFontSize(12),
    marginTop: 4,
  };

  return { inputStyle, labelStyle, errorMsgStyle };
}

export function makeFieldStyle(
  inputStyle: React.CSSProperties,
  borderColor: string,
  validationErrors: Set<string>,
  poBoxFields: Set<string>,
) {
  return (name: string): React.CSSProperties => ({
    ...inputStyle,
    borderColor:
      validationErrors.has(name) || poBoxFields.has(name) ? '#ef4444' : borderColor,
  });
}
