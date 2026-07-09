
import React from 'react';
import type { ComponentData } from '@puckeditor/core';
import { createColorField } from '../ColorField';


type SlotRender = React.FC<{
  className?: string;
  style?: React.CSSProperties;
}>;

export interface ColumnLayoutProps {
  maxWidth?: number;
  gap?: number;
  rowGap?: number;
  backgroundColor?: string;
  distribution?: string;
  mobileBreakpoint?: number;
  verticalAlign?: string;
  padding?: number;

  left?: ComponentData[] | SlotRender;
  right?: ComponentData[] | SlotRender;
}

const DISTRIBUTION_OPTIONS = [
  { label: '50% / 50%', value: '1fr 1fr' },
  { label: '55% / 45%', value: '55fr 45fr' },
  { label: '60% / 40%', value: '60fr 40fr' },
  { label: '40% / 60%', value: '40fr 60fr' },
  { label: '33% / 67%', value: '1fr 2fr' },
  { label: '67% / 33%', value: '2fr 1fr' },
  { label: '25% / 75%', value: '1fr 3fr' },
  { label: '75% / 25%', value: '3fr 1fr' },
];

const VERTICAL_ALIGN_OPTIONS = [
  { label: 'Stretch', value: 'stretch' },
  { label: 'Top', value: 'start' },
  { label: 'Center', value: 'center' },
  { label: 'Bottom', value: 'end' },
];

function scopedClass(id: string): string {
  return `puck-columns-${id}`;
}

function columnContainerStyle(backgroundColor: string): React.CSSProperties {
  return { backgroundColor };
}

function columnsGridStyle({
  maxWidth,
  padding,
  distribution,
  gap,
  verticalAlign,
}: Required<Pick<ColumnLayoutProps, 'maxWidth' | 'padding' | 'distribution' | 'gap' | 'verticalAlign'>>): React.CSSProperties {
  return {
    maxWidth: maxWidth > 0 ? maxWidth : undefined,
    margin: '0 auto',
    padding: `${padding}px 16px`,
    display: 'grid',
    gridTemplateColumns: distribution,
    gap,
    alignItems: verticalAlign,
  };
}

function columnSlotStyle(gap: number): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap,
    minWidth: 0,
    overflow: 'hidden',
  };
}

function singleItemStretchCss(scope: string): string {
  return `
    .${scope} .puck-column-left > div:only-child,
    .${scope} .puck-column-right > div:only-child {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }
  `;
}

function responsiveColumnsCss(scope: string, mobileBreakpoint: number, gap: number): string {
  return `
    @media (max-width: ${mobileBreakpoint}px) {
      .${scope} .puck-columns-inner {
        grid-template-columns: 1fr !important;
        row-gap: ${gap}px !important;
      }
      .${scope} .puck-column-left > div,
      .${scope} .puck-column-right > div {
        display: flex !important;
        flex-direction: column !important;
        gap: ${gap}px !important;
      }
    }
  `;
}

function renderSlotContent(Slot: ComponentData[] | SlotRender | undefined): React.ReactNode {
  return Slot && typeof Slot === 'function' ? <Slot /> : null;
}

export function ColumnLayout({
  maxWidth = 1200,
  gap = 24,
  rowGap,
  backgroundColor = 'transparent',
  distribution = '1fr 1fr',
  mobileBreakpoint = 768,
  verticalAlign = 'stretch',
  padding = 24,
  left: Left,
  right: Right,
}: ColumnLayoutProps) {
  const scope = scopedClass(React.useId().replace(/:/g, ''));
  const stackGap = rowGap ?? gap;

  return (
    <div
      className={`puck-columns ${scope}`}
      style={columnContainerStyle(backgroundColor)}
    >

      <div
        className="puck-columns-inner"
        style={columnsGridStyle({ maxWidth, padding, distribution, gap, verticalAlign })}
      >

        <div className="puck-column-left" style={columnSlotStyle(stackGap)}>
          {renderSlotContent(Left)}
        </div>


        <div className="puck-column-right" style={columnSlotStyle(stackGap)}>
          {renderSlotContent(Right)}
        </div>
      </div>


      <style>{singleItemStretchCss(scope) + responsiveColumnsCss(scope, mobileBreakpoint, stackGap)}</style>
    </div>
  );
}

export const ColumnLayoutConfig = {
  label: 'ColumnLayout',
  fields: {
    left: {
      type: 'slot' as const,
      label: 'Left Column',
    },
    right: {
      type: 'slot' as const,
      label: 'Right Column',
    },
    distribution: {
      type: 'select' as const,
      label: 'Column Distribution',
      options: DISTRIBUTION_OPTIONS,
    },
    maxWidth: {
      type: 'number' as const,
      label: 'Max Width (px, 0 = full)',
      min: 0,
      max: 1920,
    },
    gap: {
      type: 'number' as const,
      label: 'Column Gap (px)',
      min: 0,
      max: 64,
    },
    rowGap: {
      type: 'number' as const,
      label: 'Row Gap (px, stacked cards)',
      min: 0,
      max: 64,
    },
    padding: {
      type: 'number' as const,
      label: 'Vertical Padding (px)',
      min: 0,
      max: 100,
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
    verticalAlign: {
      type: 'select' as const,
      label: 'Vertical Alignment',
      options: VERTICAL_ALIGN_OPTIONS,
    },
    mobileBreakpoint: {
      type: 'number' as const,
      label: 'Mobile Breakpoint (px)',
      min: 320,
      max: 1024,
    },
  },
  defaultProps: {
    maxWidth: 1200,
    gap: 24,
    backgroundColor: 'transparent',
    distribution: '1fr 1fr',
    mobileBreakpoint: 768,
    verticalAlign: 'stretch',
    padding: 24,
    left: [],
    right: [],
  },
};

export default ColumnLayout;
