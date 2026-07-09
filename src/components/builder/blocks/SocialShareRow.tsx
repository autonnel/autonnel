import React from 'react';
import { createTextField, type TextFieldValue, getTextContent, getTextStyle } from '../TextField';
import { createColorField } from '../ColorField';

type Platform = 'facebook' | 'twitter' | 'instagram' | 'pinterest' | 'linkedin' | 'whatsapp' | 'email' | 'copy-link';

interface PlatformEntry {
  platform: Platform;
}

export interface SocialShareRowProps {
  title?: TextFieldValue;
  subtitle?: TextFieldValue;
  platforms?: PlatformEntry[];
  iconStyle: 'filled' | 'outline' | 'flat';
  iconColor: string;
  iconSize: number;
  align: 'left' | 'center' | 'right';
  backgroundColor?: string;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: 'f',
  twitter: 'X',
  instagram: 'IG',
  pinterest: 'P',
  linkedin: 'in',
  whatsapp: 'WA',
  email: '@',
  'copy-link': 'L',
};

export function SocialShareRow({
  title,
  subtitle,
  platforms = [],
  iconStyle = 'filled',
  iconColor = '#1f2937',
  iconSize = 32,
  align = 'center',
  backgroundColor,
}: SocialShareRowProps) {
  return (
    <section style={{ backgroundColor, padding: '32px 16px', textAlign: align }}>
      {title && (
        <div style={{ ...getTextStyle(title, { fontSize: 24, color: '#111827' }), marginBottom: 4 }}>
          {getTextContent(title, '')}
        </div>
      )}
      {subtitle && (
        <div style={{ ...getTextStyle(subtitle, { fontSize: 14, color: '#6b7280' }), marginBottom: 16 }}>
          {getTextContent(subtitle, '')}
        </div>
      )}
      <div style={{ display: 'inline-flex', gap: 12, justifyContent: align }}>
        {platforms.map((p, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Share on ${p.platform}`}
            style={{
              width: iconSize,
              height: iconSize,
              borderRadius: iconStyle === 'flat' ? 0 : iconSize / 2,
              backgroundColor: iconStyle === 'outline' ? 'transparent' : iconColor,
              border: iconStyle === 'outline' ? `2px solid ${iconColor}` : 'none',
              color: iconStyle === 'outline' ? iconColor : '#ffffff',
              fontWeight: 700,
              fontSize: iconSize * 0.4,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {PLATFORM_LABEL[p.platform]}
          </button>
        ))}
      </div>
    </section>
  );
}

export const SocialShareRowConfig = {
  fields: {
    title: createTextField({ label: 'Title', defaultColor: '#111827', defaultFontSize: 24 }),
    subtitle: createTextField({ label: 'Subtitle', defaultColor: '#6b7280', defaultFontSize: 14 }),
    platforms: {
      type: 'array' as const,
      label: 'Platforms',
      arrayFields: {
        platform: {
          type: 'select' as const,
          label: 'Platform',
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Twitter / X', value: 'twitter' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'Pinterest', value: 'pinterest' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'WhatsApp', value: 'whatsapp' },
            { label: 'Email', value: 'email' },
            { label: 'Copy Link', value: 'copy-link' },
          ],
        },
      },
    },
    iconStyle: {
      type: 'radio' as const,
      label: 'Icon Style',
      options: [
        { label: 'Filled', value: 'filled' },
        { label: 'Outline', value: 'outline' },
        { label: 'Flat (square)', value: 'flat' },
      ],
    },
    iconColor: createColorField({ label: 'Icon Color' }),
    iconSize: { type: 'number' as const, label: 'Icon Size (px)', min: 16, max: 64 },
    align: {
      type: 'radio' as const,
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
  },
  defaultProps: {
    iconStyle: 'filled',
    iconColor: '#1f2937',
    iconSize: 32,
    align: 'center',
    platforms: [
      { platform: 'facebook' },
      { platform: 'twitter' },
      { platform: 'instagram' },
      { platform: 'pinterest' },
    ],
  },
};

export default SocialShareRow;
