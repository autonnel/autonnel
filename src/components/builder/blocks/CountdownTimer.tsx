import React, { useState, useEffect } from 'react';
import { createColorField } from '../ColorField';
import {
  createTextField,
  type TextFieldValue,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
} from '../TextField';

export interface CountdownTimerProps {
  theme: 'block' | 'mini';
  hours?: number;
  minutes?: number;
  seconds?: number;
  backgroundColor?: string;
  headline?: string | TextFieldValue;
  subheadline?: string | TextFieldValue;
  ctaText?: string | TextFieldValue;
  urgencyText?: string | TextFieldValue;
  productImage?: string;
  label?: string | TextFieldValue;
  timerColor?: string;
}

interface Clock {
  hours: number;
  minutes: number;
  seconds: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

function nextTick(c: Clock, reset: Clock): Clock {
  let { hours, minutes, seconds } = c;
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return { ...reset };
  }
  if (seconds > 0) {
    seconds -= 1;
  } else if (minutes > 0) {
    minutes -= 1;
    seconds = 59;
  } else {
    hours -= 1;
    minutes = 59;
    seconds = 59;
  }
  return { hours, minutes, seconds };
}

function useCountdown(initial: Clock): Clock {
  const [clock, setClock] = useState<Clock>(initial);
  useEffect(() => {
    const id = setInterval(() => {
      setClock((prev) => nextTick(prev, initial));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return clock;
}

const DARK_BOX: React.CSSProperties = {
  background: '#1a1a1a',
  color: 'white',
  padding: '16px 24px',
  borderRadius: '12px',
  minWidth: '80px',
};

function HeroBox({ value, caption, unit }: { value: number; caption: string; unit: string }) {
  return (
    <div style={DARK_BOX}>
      <div
        data-countdown-value={unit}
        style={{ fontSize: scaledFontSize(40), fontWeight: 'bold', lineHeight: 1 }}
      >
        {pad(value)}
      </div>
      <div
        style={{
          fontSize: scaledFontSize(12),
          color: '#9ca3af',
          marginTop: '4px',
          textTransform: 'uppercase',
        }}
      >
        {caption}
      </div>
    </div>
  );
}

export function CountdownTimer({
  theme,
  hours = 2,
  minutes = 47,
  seconds = 39,
  backgroundColor = '#ffffff',
  headline,
  subheadline,
  ctaText,
  urgencyText,
  productImage,
  label,
  timerColor = '#ca3a31',
}: CountdownTimerProps) {
  const clock = useCountdown({ hours, minutes, seconds });
  const dataAttrs = {
    'data-countdown': 'true',
    'data-hours': hours,
    'data-minutes': minutes,
    'data-seconds': seconds,
  };

  if (theme === 'mini') {
    return (
      <div
        {...dataAttrs}
        style={{
          background: backgroundColor,
          padding: '10px 24px',
          textAlign: 'center',
          borderColor: 'rgb(61, 61, 61)',
          borderStyle: 'dashed',
          borderWidth: '1px',
          borderRadius: '8px',
        }}
      >
        {hasText(label) && (
          <p style={{ ...getTextStyle(label, { color: '#1a1a1a', fontSize: 14 }), margin: 0, marginBottom: '4px' }}>
            {getTextContent(label)}
          </p>
        )}
        <p
          data-countdown-value="timer"
          style={{
            margin: 0,
            fontSize: scaledFontSize(22),
            fontWeight: 700,
            color: timerColor,
            letterSpacing: '2px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pad(clock.hours)}:{pad(clock.minutes)}:{pad(clock.seconds)}
        </p>
      </div>
    );
  }

  const headlineText = getTextContent(headline);
  const subheadlineText = getTextContent(subheadline);
  const urgencyContent = getTextContent(urgencyText);

  return (
    <div style={{ padding: '80px 24px', background: backgroundColor }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        {headlineText && (
          <h2
            style={{
              ...getTextStyle(headline, { color: '#1a1a1a', fontSize: 32 }),
              fontWeight: 'bold',
              marginBottom: '16px',
              lineHeight: 1.3,
            }}
          >
            {headlineText}
          </h2>
        )}
        {subheadlineText && (
          <p style={{ ...getTextStyle(subheadline, { color: '#666666', fontSize: 16 }), marginBottom: '32px' }}>
            {subheadlineText}
          </p>
        )}
        {productImage && (
          <div style={{ marginBottom: '32px' }}>
            <img
              src={productImage}
              alt="Product"
              style={{
                maxWidth: '280px',
                maxHeight: '200px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
              }}
            />
          </div>
        )}
        <div
          {...dataAttrs}
          style={{ display: 'flex', gap: '16px', marginBottom: '32px', justifyContent: 'center' }}
        >
          <HeroBox value={clock.hours} caption="Hours" unit="hours" />
          <HeroBox value={clock.minutes} caption="Minutes" unit="minutes" />
          <HeroBox value={clock.seconds} caption="Seconds" unit="seconds" />
        </div>
        {urgencyContent && (
          <p
            style={{
              ...getTextStyle(urgencyText, { color: '#dc2626', fontSize: 14 }),
              fontWeight: 600,
              marginBottom: '24px',
            }}
          >
            {'⚡ '}
            {urgencyContent}
          </p>
        )}
        {hasText(ctaText) && (
          <button
            style={{
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              ...getTextStyle(ctaText, { color: '#ffffff', fontSize: 20 }),
              padding: '18px 48px',
              borderRadius: '12px',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)',
            }}
          >
            {getTextContent(ctaText)}
          </button>
        )}
      </div>
    </div>
  );
}

export const CountdownTimerConfig = {
  fields: {
    theme: {
      type: 'radio' as const,
      label: 'Theme',
      options: [
        { label: 'Block', value: 'block' },
        { label: 'Mini', value: 'mini' },
      ],
    },
    headline: createTextField({ label: 'Headline (Block)', defaultColor: '#1a1a1a', defaultFontSize: 32 }),
    subheadline: createTextField({ label: 'Subheadline (Block)', defaultColor: '#666666', defaultFontSize: 16 }),
    ctaText: createTextField({ label: 'Button Text (Block)', defaultColor: '#ffffff', defaultFontSize: 20 }),
    urgencyText: createTextField({ label: 'Urgency Text (Block)', defaultColor: '#dc2626', defaultFontSize: 14 }),
    productImage: { type: 'text' as const, label: 'Product Image URL (Block)' },
    label: createTextField({ label: 'Label Text (Mini)', defaultColor: '#1a1a1a', defaultFontSize: 14 }),
    timerColor: createColorField({ label: 'Timer Color (Mini)' }),
    hours: { type: 'number' as const, label: 'Starting Hours', min: 0 },
    minutes: { type: 'number' as const, label: 'Starting Minutes', min: 0, max: 59 },
    seconds: { type: 'number' as const, label: 'Starting Seconds', min: 0, max: 59 },
    backgroundColor: createColorField({ label: 'Background Color' }),
  },
  defaultProps: {
    theme: 'block' as const,
    hours: 2,
    minutes: 47,
    seconds: 39,
    backgroundColor: '#ffffff',
    headline: { text: '', color: '#1a1a1a', fontSize: 32 },
    subheadline: { text: "Limited time offer - Don't miss out!", color: '#666666', fontSize: 16 },
    ctaText: { text: 'CLAIM YOUR DISCOUNT', color: '#ffffff', fontSize: 20 },
    urgencyText: { text: 'Offer expires soon!', color: '#dc2626', fontSize: 14 },
    productImage: '',
    label: { text: 'Your 70% discount ends in:', color: '#1a1a1a', fontSize: 14 },
    timerColor: '#ca3a31',
  },
};
