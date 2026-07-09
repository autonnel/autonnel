import React from 'react';

import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
  type TextFieldValue,
} from '../TextField';

type MediaInput = string | MediaFieldValue | undefined;

function resolveImageSrc(input: MediaInput, puck?: { isEditing?: boolean }): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (input.url) return input.url;
  return placeholderUrl(input.prompt, puck);
}

const ROOT_CLASS = 'old-discount-badge';
const INNER_CLASS = 'old-discount-badge-inner';

const innerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  maxWidth: '700px',
  margin: '0 auto',
};

const fillStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const responsiveCss = `
        @media (max-width: 480px) {
          .${INNER_CLASS} {
            gap: 12px !important;
          }
        }
      `;

export interface SavingsBadgeProps {
  badgeImage?: string | MediaFieldValue;
  title?: string | TextFieldValue;
  backgroundColor?: string;
  padding?: number;
  badgeSize?: number;
}

function BadgeVisual({ badgeImage, badgeSize, puck }: Pick<SavingsBadgeProps, 'badgeImage' | 'badgeSize'> & { puck?: { isEditing?: boolean } }) {
  const src = resolveImageSrc(badgeImage, puck);
  const slot: React.CSSProperties = {
    width: `${badgeSize}px`,
    height: `${badgeSize}px`,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (!src) {
    return (
      <div style={slot}>
        <div
          style={{
            ...fillStyle,
            background: '#f3f4f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: scaledFontSize(12),
          }}
        >
          Upload
        </div>
      </div>
    );
  }

  return (
    <div style={slot}>
      <img
        src={src}
        alt="Discount Badge"
        style={{ ...fillStyle, objectFit: 'contain', ...getMediaDisplayStyle(badgeImage) }}
      />
    </div>
  );
}

export function SavingsBadge(props: SavingsBadgeProps & PuckRenderExtras) {
  const {
    badgeImage,
    title,
    backgroundColor = '#ffffff',
    padding = 24,
    badgeSize = 100,
  } = props;

  const headingStyle: React.CSSProperties = {
    ...getTextStyle(title, { color: '#b91c1c', fontSize: 24 }),
    fontWeight: 700,
    fontStyle: 'italic',
    lineHeight: 1.3,
    margin: 0,
  };

  return (
    <div className={ROOT_CLASS} style={{ background: backgroundColor, padding: `${padding}px` }}>
      <div className={INNER_CLASS} style={innerStyle}>
        <BadgeVisual badgeImage={badgeImage} badgeSize={badgeSize} puck={props.puck} />
        {hasText(title) ? <h2 style={headingStyle}>{getTextContent(title)}</h2> : null}
      </div>
      <style>{responsiveCss}</style>
    </div>
  );
}

export const SavingsBadgeConfig = {
  label: 'Old Discount Badge',
  fields: {
    badgeImage: createMediaField({ label: 'Badge Image', aspectRatio: '1:1', fieldName: 'discountBadgeImage' }),
    title: createTextField({ label: 'Title', defaultColor: '#b91c1c', defaultFontSize: 24 }),
    backgroundColor: {
      type: 'text',
      label: 'Background Color',
    },
    padding: {
      type: 'number',
      label: 'Padding',
      min: 0,
      max: 64,
    },
    badgeSize: {
      type: 'number',
      label: 'Badge Size (px)',
      min: 40,
      max: 200,
    },
  },
  defaultProps: {
    badgeImage: { url: '', prompt: '', mediaType: 'image' as const },
    title: { text: 'Your 70% Discount & Free Shipping Have Been Applied', color: '#b91c1c', fontSize: 24 },
    backgroundColor: '#ffffff',
    padding: 24,
    badgeSize: 100,
  },
  render: SavingsBadge,
};

export default SavingsBadge;
