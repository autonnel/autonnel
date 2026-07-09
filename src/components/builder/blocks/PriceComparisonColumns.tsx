import React from 'react';
import { scaledFontSize } from '../TextField';
import { createColorField } from '../ColorField';

type Tone = 'highlight' | 'muted' | 'neutral';

interface ComparisonColumn {
  label: string;
  value: string;
  tone?: Tone;
  strike?: boolean;
}

export interface PriceComparisonColumnsProps {
  columns?: ComparisonColumn[];
  highlightColor?: string;
  mutedColor?: string;
  neutralColor?: string;
  backgroundColor?: string;
  gap?: number;
  padding?: number;
}

const SEED_COLUMNS: ComparisonColumn[] = [
  { label: 'Right now', value: '$29', tone: 'highlight' },
  { label: 'Buy later', value: '$96', tone: 'muted', strike: true },
  { label: 'Ships', value: 'Same box · free', tone: 'neutral' },
];

const TONE_BG: Record<Tone, string> = {
  highlight: '#fdf4ee',
  muted: '#ffffff',
  neutral: '#f3f6f1',
};

const TONE_BORDER: Record<Tone, string> = {
  highlight: '#f0d6c4',
  muted: '#eee3d6',
  neutral: '#d9e6d8',
};

export function PriceComparisonColumns({
  columns = SEED_COLUMNS,
  highlightColor = '#C2603D',
  mutedColor = '#b6ab9c',
  neutralColor = '#3d5a40',
  backgroundColor = 'transparent',
  gap = 12,
  padding = 0,
}: PriceComparisonColumnsProps) {
  const valueColor = (tone: Tone): string =>
    tone === 'highlight' ? highlightColor : tone === 'muted' ? mutedColor : neutralColor;
  const labelColor = (tone: Tone): string =>
    tone === 'highlight' ? '#9a5436' : tone === 'neutral' ? '#4F7A52' : '#8a7e6e';

  return (
    <div data-autonnel-puck="price-comparison-columns" style={{ background: backgroundColor, padding }}>
      <div style={{ display: 'flex', gap }}>
        {columns.map((col, i) => {
          const tone = col.tone || 'muted';
          return (
            <div
              key={i}
              style={{
                flex: 1,
                background: TONE_BG[tone],
                border: `1px solid ${TONE_BORDER[tone]}`,
                borderRadius: 12,
                padding: 13,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: scaledFontSize(10),
                  color: labelColor(tone),
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                {col.label}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  color: valueColor(tone),
                  fontSize: scaledFontSize(tone === 'neutral' ? 13 : 19),
                  lineHeight: 1.2,
                  textDecoration: col.strike ? 'line-through' : 'none',
                }}
              >
                {col.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const PriceComparisonColumnsConfig = {
  label: 'Price Comparison Columns',
  fields: {
    columns: {
      type: 'array' as const,
      label: 'Columns',
      arrayFields: {
        label: { type: 'text' as const, label: 'Label' },
        value: { type: 'text' as const, label: 'Value' },
        tone: {
          type: 'select' as const,
          label: 'Tone',
          options: [
            { label: 'Highlight', value: 'highlight' },
            { label: 'Muted', value: 'muted' },
            { label: 'Neutral', value: 'neutral' },
          ],
        },
        strike: {
          type: 'radio' as const,
          label: 'Strikethrough',
          options: [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ],
        },
      },
      getItemSummary: (item: ComparisonColumn) => item?.label || 'Column',
    },
    highlightColor: createColorField({ label: 'Highlight Value Color' }),
    mutedColor: createColorField({ label: 'Muted Value Color' }),
    neutralColor: createColorField({ label: 'Neutral Value Color' }),
    backgroundColor: { type: 'text' as const, label: 'Background Color' },
    gap: { type: 'number' as const, label: 'Gap (px)', min: 0, max: 32 },
    padding: { type: 'number' as const, label: 'Padding (px)', min: 0, max: 48 },
  },
  defaultProps: {
    columns: SEED_COLUMNS,
    highlightColor: '#C2603D',
    mutedColor: '#b6ab9c',
    neutralColor: '#3d5a40',
    backgroundColor: 'transparent',
    gap: 12,
    padding: 0,
  },
  render: PriceComparisonColumns,
};

export default PriceComparisonColumns;
