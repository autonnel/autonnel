import React from 'react';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
  type TextFieldValue,
} from '../TextField';
import { createColorField } from '../ColorField';

export interface UrgencyProofBarProps {
  discountValue?: string;
  discountSubLabel?: string;
  discountColor?: string;
  headline?: string | TextFieldValue;
  reservedLabel?: string | TextFieldValue;
  reservedTime?: string;
  timeColor?: string;
  showRating?: boolean;
  starColor?: string;
  avatarColors?: { color: string }[];
  customersText?: string | TextFieldValue;
  backgroundColor?: string;
  borderColor?: string;
  padding?: number;
  fullWidth?: boolean;
}

const DEFAULT_AVATARS = [
  { color: 'linear-gradient(135deg,#C2603D,#E3A77F)' },
  { color: 'linear-gradient(135deg,#7a6f4a,#c2a45f)' },
  { color: 'linear-gradient(135deg,#4F7A52,#8fb38a)' },
];

function AvatarStack({ avatars }: { avatars: { color: string }[] }) {
  return (
    <span style={{ display: 'inline-flex' }}>
      {avatars.map((a, i) => (
        <span
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: a.color,
            border: '2px solid #fff',
            marginLeft: i === 0 ? 0 : -8,
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  );
}

export function UrgencyProofBar({
  discountValue = '70%',
  discountSubLabel = 'OFF',
  discountColor = '#4F7A52',
  headline = { text: 'Your 70% discount & free shipping are applied', color: '#9a5436', fontSize: 13 },
  reservedLabel = { text: 'Reserved for', color: '#8a7e6e', fontSize: 12 },
  reservedTime = '07:11',
  timeColor = '#C2603D',
  showRating = true,
  starColor = '#E0A23B',
  avatarColors = DEFAULT_AVATARS,
  customersText = { text: '34,245+ happy customers', color: '#6f685e', fontSize: 12 },
  backgroundColor = '#ffffff',
  borderColor = '#eaddcd',
  padding = 14,
  fullWidth = false,
}: UrgencyProofBarProps) {
  const headlineStyle = getTextStyle(headline, { color: '#9a5436', fontSize: 13 });
  const reservedStyle = getTextStyle(reservedLabel, { color: '#8a7e6e', fontSize: 12 });
  const customersStyle = getTextStyle(customersText, { color: '#6f685e', fontSize: 12 });

  return (
    <div
      data-autonnel-puck="urgency-proof-bar"
      className={fullWidth ? 'puck-full-width' : undefined}
      style={{
        background: backgroundColor,
        borderBottom: `1px solid ${borderColor}`,
        padding: `${padding}px 32px`,
      }}
    >
      <div
        className={fullWidth ? 'puck-full-width-inner' : undefined}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          {discountValue ? (
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: discountColor,
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize: scaledFontSize(13), fontWeight: 800 }}>{discountValue}</span>
              {discountSubLabel ? (
                <span style={{ fontSize: scaledFontSize(8), letterSpacing: '0.05em' }}>{discountSubLabel}</span>
              ) : null}
            </span>
          ) : null}
          <div style={{ minWidth: 0 }}>
            {hasText(headline) ? (
              <div style={{ fontWeight: 800, color: headlineStyle.color, fontSize: headlineStyle.fontSize }}>
                {getTextContent(headline)}
              </div>
            ) : null}
            {hasText(reservedLabel) || reservedTime ? (
              <div style={{ fontSize: reservedStyle.fontSize, color: reservedStyle.color }}>
                {getTextContent(reservedLabel)}{' '}
                <strong style={{ color: timeColor, fontVariantNumeric: 'tabular-nums' }}>{reservedTime}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          {showRating ? (
            <div style={{ color: starColor, fontSize: scaledFontSize(14), letterSpacing: '1px' }}>★★★★★</div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end', marginTop: 3 }}>
            <AvatarStack avatars={avatarColors} />
            {hasText(customersText) ? (
              <span style={{ fontSize: customersStyle.fontSize, color: customersStyle.color, fontWeight: 700 }}>
                {getTextContent(customersText)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export const UrgencyProofBarConfig = {
  label: 'Urgency + Proof Bar',
  fields: {
    discountValue: { type: 'text' as const, label: 'Discount Badge (e.g. 70%)' },
    discountSubLabel: { type: 'text' as const, label: 'Discount Badge Sub-label' },
    discountColor: createColorField({ label: 'Discount Badge Color' }),
    headline: createTextField({ label: 'Headline', defaultColor: '#9a5436', defaultFontSize: 13 }),
    reservedLabel: createTextField({ label: 'Reserved Label', defaultColor: '#8a7e6e', defaultFontSize: 12 }),
    reservedTime: { type: 'text' as const, label: 'Reserved Time (e.g. 07:11)' },
    timeColor: createColorField({ label: 'Time Color' }),
    showRating: {
      type: 'radio' as const,
      label: 'Show Rating',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    starColor: createColorField({ label: 'Star Color' }),
    avatarColors: {
      type: 'array' as const,
      label: 'Avatars (color / gradient)',
      arrayFields: { color: { type: 'text' as const, label: 'Background (color or gradient)' } },
      getItemSummary: (item: { color?: string }) => item?.color || 'Avatar',
    },
    customersText: createTextField({ label: 'Customers Text', defaultColor: '#6f685e', defaultFontSize: 12 }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    borderColor: createColorField({ label: 'Border Color' }),
    padding: { type: 'number' as const, label: 'Padding (px)', min: 4, max: 48 },
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
    discountValue: '70%',
    discountSubLabel: 'OFF',
    discountColor: '#4F7A52',
    headline: { text: 'Your 70% discount & free shipping are applied', color: '#9a5436', fontSize: 13 },
    reservedLabel: { text: 'Reserved for', color: '#8a7e6e', fontSize: 12 },
    reservedTime: '07:11',
    timeColor: '#C2603D',
    showRating: true,
    starColor: '#E0A23B',
    avatarColors: DEFAULT_AVATARS,
    customersText: { text: '34,245+ happy customers', color: '#6f685e', fontSize: 12 },
    backgroundColor: '#ffffff',
    borderColor: '#eaddcd',
    padding: 14,
    fullWidth: false,
  },
  render: UrgencyProofBar,
};

export default UrgencyProofBar;
