import React, { useEffect, useState } from 'react';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
  type TextFieldValue,
} from '../TextField';

export interface StockMeterProps {
  prefix?: string | TextFieldValue;
  count?: number;
  suffix?: string | TextFieldValue;
  backgroundColor?: string;
  highlightColor?: string;
  randomize?: boolean;
  minCount?: number;
  maxCount?: number;
  fullWidth?: boolean;
}

const LABEL_DEFAULTS = { color: '#ffffff', fontSize: 16 } as const;

const WRAPPER_STYLE: React.CSSProperties = {
  background: '',
  padding: '12px 24px',
  textAlign: 'center',
};

const LINE_STYLE: React.CSSProperties = {
  fontWeight: 600,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

function pickInRange(low: number, high: number): number {
  const span = high - low + 1;
  return low + Math.floor(Math.random() * span);
}

export function StockMeter(props: StockMeterProps) {
  const {
    prefix = { text: 'Only', ...LABEL_DEFAULTS },
    count = 9,
    suffix = { text: 'Items left in stock!', ...LABEL_DEFAULTS },
    backgroundColor = '#1a1a2e',
    highlightColor = '#22c55e',
    randomize = false,
    minCount = 3,
    maxCount = 15,
    fullWidth = false,
  } = props;

  const [shown, setShown] = useState(count);

  useEffect(() => {
    setShown(randomize ? pickInRange(minCount, maxCount) : count);
  }, [randomize, count, minCount, maxCount]);

  const leadStyle = getTextStyle(prefix, LABEL_DEFAULTS);
  const trailStyle = getTextStyle(suffix, LABEL_DEFAULTS);
  const numberStyle: React.CSSProperties = {
    color: highlightColor,
    fontWeight: 700,
    fontSize: scaledFontSize(18),
  };

  const outerClass = fullWidth ? 'old-stock-counter puck-full-width' : 'old-stock-counter';

  return (
    <div className={outerClass} style={{ ...WRAPPER_STYLE, background: backgroundColor }}>
      <div className={fullWidth ? 'puck-full-width-inner' : undefined}>
        <p style={LINE_STYLE}>
          {hasText(prefix) ? <span style={leadStyle}>{getTextContent(prefix)}</span> : null}
          <span style={numberStyle}>{shown}</span>
          {hasText(suffix) ? <span style={trailStyle}>{getTextContent(suffix)}</span> : null}
        </p>
      </div>
    </div>
  );
}

export const StockMeterConfig = {
  label: 'Old Stock Counter',
  fields: {
    prefix: createTextField({ label: 'Prefix Text', defaultColor: '#ffffff', defaultFontSize: 16 }),
    count: {
      type: 'number',
      label: 'Stock Count',
      min: 1,
      max: 100,
    },
    suffix: createTextField({ label: 'Suffix Text', defaultColor: '#ffffff', defaultFontSize: 16 }),
    backgroundColor: {
      type: 'text',
      label: 'Background Color',
    },
    highlightColor: {
      type: 'text',
      label: 'Highlight Color',
    },
    randomize: {
      type: 'radio',
      label: 'Randomize Count',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    minCount: {
      type: 'number',
      label: 'Min Random Count',
      min: 1,
      max: 50,
    },
    maxCount: {
      type: 'number',
      label: 'Max Random Count',
      min: 1,
      max: 100,
    },
    fullWidth: {
      type: 'radio' as const,
      label: 'Full Width (break out of container)',
      options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
      ],
    },
  },
  defaultProps: {
    prefix: { text: 'Only', color: '#ffffff', fontSize: 16 },
    count: 9,
    suffix: { text: 'Items left in stock!', color: '#ffffff', fontSize: 16 },
    backgroundColor: '#1a1a2e',
    highlightColor: '#22c55e',
    randomize: false,
    minCount: 3,
    maxCount: 15,
    fullWidth: false,
  },
  render: StockMeter,
};

export default StockMeter;
