import React from 'react';
import { scaledFontSize } from '../TextField';
import { createColorField } from '../ColorField';

interface TrustBadge {
  label: string;
  color?: string;
  showCheck?: boolean;
}

export interface TrustBadgeRowProps {
  badges?: TrustBadge[];
  align?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  borderColor?: string;
  fontSize?: number;
  gap?: number;
  padding?: number;
  fullWidth?: boolean;
}

const SEED_BADGES: TrustBadge[] = [
  { label: 'Norton', color: '#4F7A52', showCheck: true },
  { label: 'McAfee SECURE', color: '#c8102e' },
  { label: 'VERIFIED by VISA', color: '#1a1f71' },
  { label: 'TRUSTe', color: '#2e7d32' },
];

export function TrustBadgeRow({
  badges = SEED_BADGES,
  align = 'center',
  backgroundColor = 'transparent',
  borderColor = '#e0d3c2',
  fontSize = 10,
  gap = 6,
  padding = 0,
  fullWidth = false,
}: TrustBadgeRowProps) {
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <div
      data-autonnel-puck="trust-badge-row"
      className={fullWidth ? 'puck-full-width' : undefined}
      style={{ background: backgroundColor, padding }}
    >
      <div
        className={fullWidth ? 'puck-full-width-inner' : undefined}
        style={{ display: 'flex', flexWrap: 'wrap', gap, justifyContent: justify }}
      >
        {badges.map((badge, i) => (
          <span
            key={i}
            style={{
              fontSize: scaledFontSize(fontSize),
              fontWeight: 700,
              border: `1px solid ${borderColor}`,
              borderRadius: 5,
              padding: '4px 8px',
              color: badge.color || '#4a443c',
              whiteSpace: 'nowrap',
            }}
          >
            {badge.showCheck ? '✓ ' : ''}
            {badge.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const TrustBadgeRowConfig = {
  label: 'Trust Badge Row',
  fields: {
    badges: {
      type: 'array' as const,
      label: 'Badges',
      arrayFields: {
        label: { type: 'text' as const, label: 'Label' },
        color: createColorField({ label: 'Text Color' }),
        showCheck: {
          type: 'radio' as const,
          label: 'Leading ✓',
          options: [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ],
        },
      },
      getItemSummary: (item: TrustBadge) => item?.label || 'Badge',
    },
    align: {
      type: 'radio' as const,
      label: 'Align',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    backgroundColor: { type: 'text' as const, label: 'Background Color' },
    borderColor: createColorField({ label: 'Border Color' }),
    fontSize: { type: 'number' as const, label: 'Font Size (px)', min: 8, max: 16 },
    gap: { type: 'number' as const, label: 'Gap (px)', min: 0, max: 24 },
    padding: { type: 'number' as const, label: 'Padding (px)', min: 0, max: 48 },
    fullWidth: {
      type: 'radio' as const,
      label: 'Full Width',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
  },
  defaultProps: {
    badges: SEED_BADGES,
    align: 'center',
    backgroundColor: 'transparent',
    borderColor: '#e0d3c2',
    fontSize: 10,
    gap: 6,
    padding: 0,
    fullWidth: false,
  },
  render: TrustBadgeRow,
};

export default TrustBadgeRow;
