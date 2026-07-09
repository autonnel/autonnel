import React, { type ReactNode } from 'react';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { RichBody } from './RichBody';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { createColorField } from '../ColorField';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';
import {
  createTextField,
  type TextFieldValue,
  getTextContent,
  getTextString,
  getTextStyle,
  hasText,
  scaledFontSize,
} from '../TextField';

interface BulletPoint {
  icon?: string;
  title: string;
  description?: string;
}

interface ThemeColors {
  title: string;
  text: string;
  textMuted: string;
  sectionTitle: string;
}

const DARK_THEME: ThemeColors = {
  title: '#1a1a1a',
  text: '#1a1a1a',
  textMuted: '#64748b',
  sectionTitle: '#666666',
};

const LIGHT_THEME: ThemeColors = {
  title: '#ffffff',
  text: 'rgba(255,255,255,0.9)',
  textMuted: 'rgba(255,255,255,0.7)',
  sectionTitle: 'rgba(255,255,255,0.6)',
};

function getMediaUrl(media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || placeholderUrl(media.prompt, puck);
}

function isVideoUrl(url: string): boolean {
  return url.includes('.mp4') || url.includes('.webm');
}

function parseColor(input: string): [number, number, number] | null {
  const value = input.trim();
  if (!value) return null;

  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  const rgbMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  return null;
}

function getContrastColor(background: string | undefined): ThemeColors {
  const rgb = parseColor(background || '');
  if (!rgb) return DARK_THEME;
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.5 ? DARK_THEME : LIGHT_THEME;
}

export function ImageTextSplit(props: {
  sectionTitle?: string | TextFieldValue;
  headline: string | TextFieldValue;
  description?: string | ReactNode;
  bulletPoints?: BulletPoint[];
  image?: string | MediaFieldValue;
  imagePosition?: 'left' | 'right';
  backgroundColor?: string;
  ctaText?: string | TextFieldValue;
  ctaColor?: string;
  ctaLink?: string | URLFieldValue;
} & PuckRenderExtras) {
  const {
    sectionTitle,
    headline,
    description,
    bulletPoints = [],
    image,
    imagePosition = 'left',
    backgroundColor = '#ffffff',
    ctaText,
    ctaColor,
    ctaLink,
  } = props;

  const colors = getContrastColor(backgroundColor);
  const imageUrl = getMediaUrl(image, props.puck);
  const showCta = hasText(ctaText);
  const ctaHref = getURLString(ctaLink);

  const sectionTitleStyle = getTextStyle(sectionTitle, {
    color: colors.sectionTitle,
    fontSize: 14,
  });
  const headlineStyle = getTextStyle(headline, {
    color: colors.title,
    fontSize: 36,
  });
  const ctaTextStyle = getTextStyle(ctaText, { color: '#ffffff', fontSize: 16 });

  return (
    <SectionOverlay show={shouldShowOverlay({})} sectionName="Image + Text">
      <div className="lp-section-padding" style={{ background: backgroundColor }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {getTextContent(sectionTitle) && (
            <h3
              style={{
                textAlign: 'center',
                ...sectionTitleStyle,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: 40,
              }}
            >
              {getTextContent(sectionTitle)}
            </h3>
          )}

          <div className={imageUrl ? 'lp-grid-2-cols' : ''}>
            {imageUrl && (
              <div
                className="lp-image-first-mobile"
                style={{
                  order: imagePosition === 'right' ? 2 : 1,
                  aspectRatio: '800/758',
                  borderRadius: 16,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  background: '#e2e8f0',
                }}
              >
                {isVideoUrl(imageUrl) ? (
                  <video
                    src={imageUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', ...getMediaDisplayStyle(image) }}
                  />
                ) : (
                  <img
                    src={imageUrl}
                    alt={getTextString(headline)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', ...getMediaDisplayStyle(image) }}
                  />
                )}
              </div>
            )}

            <div
              className={imageUrl ? 'lp-content-second-mobile' : ''}
              style={{ order: imagePosition === 'right' ? 1 : 2 }}
            >
              {hasText(headline) && (
                <h2
                  className="lp-section-title"
                  style={{ ...headlineStyle, fontWeight: 'bold', marginBottom: 20 }}
                >
                  {getTextContent(headline)}
                </h2>
              )}

              <RichBody
                value={description}
                style={{
                  fontSize: scaledFontSize(16),
                  color: colors.textMuted,
                  lineHeight: 1.8,
                  marginBottom: bulletPoints.length > 0 || showCta ? '28px' : '0',
                }}
              />

              {bulletPoints.length > 0 && (
                <div style={{ marginBottom: showCta ? '28px' : '0' }}>
                  {bulletPoints.map((point, index) => {
                    if (!point) return null;
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 14,
                          marginBottom: 16,
                        }}
                      >
                        {point.icon && (
                          <span
                            style={{
                              flexShrink: 0,
                              width: 28,
                              height: 28,
                              background: '#dcfce7',
                              color: '#16a34a',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: scaledFontSize(14),
                              fontWeight: 'bold',
                            }}
                          >
                            {point.icon}
                          </span>
                        )}
                        <div>
                          <h4
                            style={{
                              fontSize: scaledFontSize(16),
                              fontWeight: 600,
                              color: colors.text,
                              marginBottom: point.description ? '4px' : '0',
                            }}
                          >
                            {point.title}
                          </h4>
                          {point.description && (
                            <RichBody
                              value={point.description}
                              style={{
                                fontSize: scaledFontSize(14),
                                color: colors.textMuted,
                                lineHeight: 1.6,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showCta && (() => {
                const buttonStyle: React.CSSProperties = {
                  display: 'inline-block',
                  background: ctaColor || 'linear-gradient(135deg, #f97316, #ea580c)',
                  ...ctaTextStyle,
                  padding: '14px 32px',
                  borderRadius: 8,
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: ctaColor
                    ? '0 4px 16px rgba(0, 0, 0, 0.15)'
                    : '0 4px 16px rgba(249, 115, 22, 0.3)',
                };
                const label = getTextContent(ctaText);
                return ctaHref ? (
                  <a href={ctaHref} suppressHydrationWarning style={buttonStyle}>
                    {label}
                  </a>
                ) : (
                  <button style={buttonStyle}>{label}</button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </SectionOverlay>
  );
}

export const ImageTextSplitConfig = {
  fields: {
    sectionTitle: createTextField({
      label: 'Section Title (uppercase)',
      defaultColor: '#666666',
      defaultFontSize: 14,
    }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    headline: createTextField({
      label: 'Main Headline',
      defaultColor: '#1a1a1a',
      defaultFontSize: 36,
    }),
    description: {
      type: 'richtext',
      label: 'Description (50-80 words)',
      contentEditable: true,
    },
    bulletPoints: {
      type: 'array',
      label: 'Bullet Points',
      arrayFields: {
        icon: { type: 'text', label: 'Icon (emoji)', contentEditable: true },
        title: { type: 'text', label: 'Title', contentEditable: true },
        description: { type: 'richtext', label: 'Description', contentEditable: true },
      },
      getItemSummary: (item: BulletPoint | undefined) => item?.title || 'Point',
    },
    image: createMediaField({
      label: 'Section Image',
      aspectRatio: '800:758',
      fieldName: 'image',
    }),
    imagePosition: {
      type: 'radio',
      label: 'Image Position',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ],
    },
    ctaText: createTextField({
      label: 'Button Text (optional)',
      defaultColor: '#ffffff',
      defaultFontSize: 16,
    }),
    ctaColor: createColorField({ label: 'Button Color (empty = orange gradient)' }),
    ctaLink: createURLField({ label: 'Button Link', placeholder: 'Enter URL or select funnel step' }),
  },
  defaultProps: {
    sectionTitle: { text: 'THE MAGIC', color: '#666666', fontSize: 14 },
    backgroundColor: '#ffffff',
    headline: { text: 'User-Friendly and Results-Driven', color: '#1a1a1a', fontSize: 36 },
    description:
      'Our innovative solution combines cutting-edge technology with natural ingredients to deliver exceptional results you can see and feel.',
    bulletPoints: [],
    image: { url: '', prompt: '', mediaType: 'image' },
    imagePosition: 'left',
    ctaText: { text: '', color: '#ffffff', fontSize: 16 },
    ctaColor: '',
    ctaLink: { type: 'custom' as const, url: '' },
  },
};
