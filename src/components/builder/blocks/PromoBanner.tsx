import React from 'react';
import { createColorField } from '../ColorField';
import { createTextField, type TextFieldValue, getTextContent, getTextStyle, hasText } from '../TextField';

export interface PromoBannerProps {
  saleText?: string | TextFieldValue;
  discountText?: string | TextFieldValue;
  gradientStart?: string;
  gradientEnd?: string;
  fullWidth?: boolean;
}

const ACCENT = '#3b82f6';
const ACCENT_SIZE = 36;

const SHELL_STYLE: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(62.37% 62.37%, rgb(113, 172, 248) 0px, rgb(6, 59, 125) 0.01%, rgb(0, 0, 0) 100%)',
  padding: '16px 24px',
  textAlign: 'center',
};

const HEADLINE_STYLE: React.CSSProperties = {
  fontFamily: "'Impact', 'Arial Black', sans-serif",
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '2px',
  fontStyle: 'italic',
};

const BLINK_KEYFRAMES = `
        @keyframes blinker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .old-sale-banner-text {
          animation-name: blinker;
          animation-duration: 1.2s;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-direction: normal;
          animation-fill-mode: none;
          animation-delay: 0s;
          animation-play-state: running;
        }
      `;

export function PromoBanner({
  saleText = 'WINTER SALE',
  discountText = '-70% OFF',
  gradientStart = '#c0392b',
  gradientEnd = '#e67e22',
  fullWidth = false,
}: PromoBannerProps) {
  const showSale = hasText(saleText);
  const showDiscount = hasText(discountText);

  if (!showSale && !showDiscount) return null;

  const accentDefaults = { color: ACCENT, fontSize: ACCENT_SIZE };
  const shellClass = fullWidth ? 'old-sale-banner puck-full-width' : 'old-sale-banner';

  return (
    <div style={SHELL_STYLE} className={shellClass}>
      <style>{BLINK_KEYFRAMES}</style>
      <div className={fullWidth ? 'puck-full-width-inner' : undefined}>
        <div className="old-sale-banner-text" style={HEADLINE_STYLE}>
          {showSale && (
            <span style={getTextStyle(saleText, accentDefaults)}>{getTextContent(saleText)}</span>
          )}
          {showSale && showDiscount && ' '}
          {showDiscount && (
            <span style={getTextStyle(discountText, accentDefaults)}>{getTextContent(discountText)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const PromoBannerConfig = {
  label: 'Old Sale Banner',
  fields: {
    saleText: createTextField({ label: 'Sale Text', defaultColor: ACCENT, defaultFontSize: ACCENT_SIZE }),
    discountText: createTextField({ label: 'Discount Text', defaultColor: ACCENT, defaultFontSize: ACCENT_SIZE }),
    gradientStart: createColorField({ label: 'Gradient Start Color' }),
    gradientEnd: createColorField({ label: 'Gradient End Color' }),
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
    saleText: { text: 'WINTER SALE', color: ACCENT, fontSize: ACCENT_SIZE },
    discountText: { text: '-70% OFF', color: ACCENT, fontSize: ACCENT_SIZE },
    gradientStart: '#c0392b',
    gradientEnd: '#e67e22',
    fullWidth: false,
  },
  render: PromoBanner,
};

export default PromoBanner;
