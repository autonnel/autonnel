import React from 'react';
import type { CSSProperties } from 'react';
import type { ComponentConfig } from '@puckeditor/core';
import { createColorField } from '../ColorField';

export interface CheckoutGridProps {
  maxWidth?: number;
  padding?: number;
  backgroundColor?: string;
  children?: React.ReactNode;
}

const DEFAULTS = {
  maxWidth: 960,
  padding: 24,
  backgroundColor: '#f8fafc',
} as const;

const WRAP_CLASS = 'autonnel-checkout-layout';
const SIDE_INSET = 16;
const STACK_GAP = 24;

function buildOuterStyle(bg: string, verticalPad: number): CSSProperties {
  return {
    minHeight: '100vh',
    backgroundColor: bg,
    padding: `${verticalPad}px ${SIDE_INSET}px`,
  };
}

function buildInnerStyle(width: number): CSSProperties {
  return {
    maxWidth: width,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: STACK_GAP,
  };
}

export function CheckoutGrid(props: CheckoutGridProps) {
  const width = props.maxWidth ?? DEFAULTS.maxWidth;
  const verticalPad = props.padding ?? DEFAULTS.padding;
  const bg = props.backgroundColor ?? DEFAULTS.backgroundColor;

  return (
    <div className={WRAP_CLASS} style={buildOuterStyle(bg, verticalPad)}>
      <div style={buildInnerStyle(width)}>{props.children}</div>
    </div>
  );
}

const checkoutFields: ComponentConfig<CheckoutGridProps>['fields'] = {
  maxWidth: { type: 'number', label: 'Max Width (px)', min: 600, max: 1400 },
  padding: { type: 'number', label: 'Vertical Padding', min: 0, max: 100 },
  backgroundColor: createColorField({ label: 'Background Color' }),
};

export const CheckoutGridConfig: ComponentConfig<CheckoutGridProps> &
  Required<Pick<ComponentConfig<CheckoutGridProps>, 'fields'>> = {
  label: 'Checkout Layout',
  fields: checkoutFields,
  defaultProps: { ...DEFAULTS },
  render: ({ children, ...rest }) => (
    <CheckoutGrid {...rest}>{children}</CheckoutGrid>
  ),
};

export default CheckoutGrid;
