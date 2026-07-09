import React from 'react';
import { RichBody } from './RichBody';
import { createMediaField, getMediaDisplayStyle } from '../MediaField';
import { createURLField, getURLString } from '../URLField';
import { createColorField } from '../ColorField';
import { createTextField, getTextContent, getTextStyle, hasText, scaledFontSize } from '../TextField';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { type PuckRenderExtras } from '../media-placeholder';
import {
  type HeroPanelProps,
  getItemTextContent,
  getItemTextStyle,
  getMediaUrl,
  isVideoUrl,
  parseColor,
} from './HeroPanel.helpers';

export function HeroPanel({

  logoImage,
  logoHeight = 80,
  tagline,
  headline,
  subheadline,
  benefits = [],
  benefitIconColor,
  ctaText,
  ctaLink = '',
  ctaColor = '#f97316',
  trustBadges = [],
  backgroundImage,
  productImage,
  backgroundBlur = 0,
  backgroundOverlay = 0,
  fullWidth = false,
  imagePosition = 'background',
  contentAlign = 'left',
  overlayColor,
  padding = 40,
  maxWidth = 1080,
  puck,
}: HeroPanelProps & PuckRenderExtras) {
  const bgUrl = getMediaUrl(backgroundImage, puck);
  const bgIsVideo = isVideoUrl(bgUrl);
  const productUrl = getMediaUrl(productImage, puck);
  const productIsVideo = isVideoUrl(productUrl);
  const logoUrl = getMediaUrl(logoImage, puck);
  const linkUrl = getURLString(ctaLink) || '#';

  const showOverlay = shouldShowOverlay({});

  const blurValue = Math.max(0, Math.min(20, backgroundBlur));
  const overlayOpacity = Math.max(0, Math.min(80, backgroundOverlay)) / 100;


  const overlayBg = ((): string | null => {
    if (overlayColor) {
      const parsed = parseColor(overlayColor);
      if (parsed) {
        const finalAlpha = parsed.a !== 1 ? parsed.a : overlayOpacity;
        if (finalAlpha <= 0) return null;
        return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${finalAlpha})`;
      }
      return overlayColor;
    }
    return overlayOpacity > 0 ? `rgba(0, 0, 0, ${overlayOpacity})` : null;
  })();

  const useLightText = bgUrl && overlayOpacity > 0.15 && imagePosition === 'background';
  const showBgImage = imagePosition === 'background' && !!bgUrl;
  const showProductSlot = imagePosition !== 'background';
  const productOnly = imagePosition === 'top' || imagePosition === 'bottom';
  const productLeading = imagePosition === 'left' || imagePosition === 'top';

  const contentTextAlign: React.CSSProperties['textAlign'] =
    contentAlign === 'center' ? 'center' : contentAlign === 'right' ? 'right' : 'left';
  const benefitsJustify: React.CSSProperties['justifyContent'] =
    contentAlign === 'center' ? 'center' : contentAlign === 'right' ? 'flex-end' : 'flex-start';

  const productMedia = showProductSlot ? (
    productIsVideo ? (
      <video
        src={productUrl}
        autoPlay
        muted
        loop
        playsInline
        style={{
          maxWidth: '100%',
          maxHeight: '500px',
          objectFit: 'contain',
          filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))',
          borderRadius: '12px',
          ...getMediaDisplayStyle(productImage),
        }}
      />
    ) : productUrl ? (
      <img
        src={productUrl}
        alt="Product"
        style={{
          maxWidth: '100%',
          maxHeight: '500px',
          objectFit: 'contain',
          filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.15))',
          ...getMediaDisplayStyle(productImage),
        }}
      />
    ) : null
  ) : null;

  const containerLayout: React.CSSProperties = productOnly
    ? {
        display: 'flex',
        flexDirection: productLeading ? 'column' : 'column-reverse',
        gap: '32px',
        alignItems: contentAlign === 'center' ? 'center' : contentAlign === 'right' ? 'flex-end' : 'flex-start',
      }
    : showProductSlot
      ? {
          display: 'flex',
          flexDirection: productLeading ? 'row' : 'row-reverse',
          gap: '48px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }
      : {
          display: 'block',
        };

  return (
    <SectionOverlay show={showOverlay} sectionName="Hero Banner">
    <div
      className={`lp-section-padding${fullWidth ? ' puck-full-width' : ''}`}
      style={{
        minHeight: '600px',
        backgroundColor: !showBgImage && overlayColor ? overlayColor : '#f5f5f0',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: `${padding}px 16px`,
      }}
    >

      {showBgImage && !bgIsVideo && (
        <img
          src={bgUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
            transform: blurValue > 0 ? 'scale(1.1)' : 'none',
            ...getMediaDisplayStyle(backgroundImage),
          }}
        />
      )}


      {showBgImage && bgIsVideo && (
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: blurValue > 0 ? `blur(${blurValue}px)` : 'none',
            transform: blurValue > 0 ? 'scale(1.1)' : 'none',
            ...getMediaDisplayStyle(backgroundImage),
          }}
        >
          <source src={bgUrl} type="video/mp4" />
        </video>
      )}


      {showBgImage && overlayBg && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: overlayBg,
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        className={fullWidth ? 'puck-full-width-inner' : undefined}
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: `${maxWidth}px`,
          margin: '0 auto',
          width: '100%',
          ...containerLayout,
        }}
      >

        <div style={{
          flex: showProductSlot && !productOnly ? '1 1 320px' : undefined,
          minWidth: showProductSlot && !productOnly ? 0 : undefined,
          textAlign: contentTextAlign,
        }}>

          {logoUrl && (
            <div style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent: benefitsJustify,
            }}>
              <img
                src={logoUrl}
                alt="Logo"
                style={{
                  width: 'auto',
                  height: `${logoHeight}px`,
                  objectFit: 'contain',
                  ...getMediaDisplayStyle(logoImage),
                }}
              />
            </div>
          )}


          {getTextContent(tagline) && (
            <p style={{
              ...getTextStyle(tagline, { color: useLightText ? '#86efac' : '#16a34a', fontSize: 14 }),
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '12px',
            }}>
              {getTextContent(tagline)}
            </p>
          )}


          {hasText(headline) && (
            <h1
              className="lp-headline"
              style={{
                ...getTextStyle(headline, { color: useLightText ? '#ffffff' : '#1a1a1a' }),
                fontWeight: 'bold',
                marginBottom: '20px',
                textShadow: useLightText ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              {getTextContent(headline)}
            </h1>
          )}


          <RichBody
            value={subheadline}
            style={{
              fontSize: scaledFontSize(18),
              marginBottom: '24px',
              color: useLightText ? 'rgba(255,255,255,0.9)' : '#4a4a4a',
              lineHeight: 1.6,
              textShadow: useLightText ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
            }}
          />


          {benefits.length > 0 && (
            <ul style={{
              listStyle: 'none',
              padding: 0,
              marginBottom: '28px',
            }}>
              {benefits.map((benefit, i) => {
                const text = getItemTextContent(benefit);
                if (!text) return null;
                const benefitStyle = getItemTextStyle(benefit, {
                  color: useLightText ? 'rgba(255,255,255,0.95)' : '#333333',
                  fontSize: 15,
                });
                const benefitIcon = (typeof benefit === 'object' && benefit && 'icon' in benefit ? benefit.icon : undefined) || '✓';
                const useBadge = !!benefitIconColor;
                return (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: benefitsJustify,
                    gap: '12px',
                    marginBottom: '10px',
                    ...benefitStyle,
                    textShadow: useLightText ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                  }}>
                    {useBadge ? (
                      <span style={{
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: benefitIconColor,
                        color: '#ffffff',
                        fontSize: scaledFontSize(14),
                        lineHeight: 1,
                      }}>{benefitIcon}</span>
                    ) : (
                      <span style={{ color: useLightText ? '#86efac' : '#16a34a', fontSize: scaledFontSize(18) }}>{benefitIcon}</span>
                    )}
                    {text}
                  </li>
                );
              })}
            </ul>
          )}


          {hasText(ctaText) && (
            <a
              href={linkUrl}
              style={{
                display: 'inline-block',
                background: `linear-gradient(135deg, ${ctaColor}, ${ctaColor}dd)`,
                ...getTextStyle(ctaText, { color: '#ffffff', fontSize: 18 }),
                padding: '16px 40px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: `0 4px 16px ${ctaColor}66`,
                marginBottom: '24px',
                textDecoration: 'none',
              }}
            >
              {getTextContent(ctaText)}
            </a>
          )}


          {trustBadges.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: benefitsJustify,
              gap: '24px',
              flexWrap: 'wrap',
            }}>
              {trustBadges.map((badge, i) => {
                const text = getItemTextContent(badge);
                if (!text) return null;
                const badgeStyle = getItemTextStyle(badge, {
                  color: useLightText ? 'rgba(255,255,255,0.8)' : '#666666',
                  fontSize: 13,
                });
                return (
                  <span key={i} style={{
                    ...badgeStyle,
                    fontWeight: 500,
                  }}>
                    {text}
                  </span>
                );
              })}
            </div>
          )}
        </div>


        {showProductSlot && (
          <div style={{
            flex: !productOnly ? '1 1 320px' : undefined,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: productOnly ? '100%' : undefined,
          }}>
            {productMedia}
          </div>
        )}
      </div>
    </div>
    </SectionOverlay>
  );
}

export const HeroPanelConfig = {
  fields: {
    logoImage: createMediaField({ label: 'Logo Image (Square)', aspectRatio: '1:1', fieldName: 'logoImage' }),
    tagline: createTextField({ label: 'Tagline (above headline)', defaultColor: '#16a34a', defaultFontSize: 14 }),
    headline: createTextField({ label: 'Main Headline', defaultColor: '#1a1a1a', defaultFontSize: 36 }),
    subheadline: { type: 'richtext' as const, label: 'Subheadline', contentEditable: true },
    benefits: {
      type: 'array' as const,
      label: 'Benefits List',
      arrayFields: {
        value: createTextField({ label: 'Benefit', defaultColor: '#333333', defaultFontSize: 15 }),
      },
      getItemSummary: (item: any) => {
        if (typeof item === 'string') return item || 'Benefit';
        const v = item?.value;
        if (typeof v === 'string') return v || 'Benefit';
        return v?.text || 'Benefit';
      },
      defaultItemProps: { value: { text: '', color: '#333333', fontSize: 15 } },
    },
    ctaText: createTextField({ label: 'Button Text', defaultColor: '#ffffff', defaultFontSize: 18 }),
    ctaColor: createColorField({ label: 'Button Color (hex, e.g. #f97316)' }),
    ctaLink: createURLField({ label: 'Button Link (URL)', placeholder: 'Enter URL or select funnel step' }),
    trustBadges: {
      type: 'array' as const,
      label: 'Trust Badges',
      arrayFields: {
        value: createTextField({ label: 'Badge', defaultColor: '#666666', defaultFontSize: 13 }),
      },
      getItemSummary: (item: any) => {
        if (typeof item === 'string') return item || 'Badge';
        const v = item?.value;
        if (typeof v === 'string') return v || 'Badge';
        return v?.text || 'Badge';
      },
      defaultItemProps: { value: { text: '', color: '#666666', fontSize: 13 } },
    },
    productImage: createMediaField({ label: 'Product Image / Video', aspectRatio: '4:5', fieldName: 'productImage' }),
    backgroundImage: createMediaField({ label: 'Background Image / Video', aspectRatio: '16:9', fieldName: 'backgroundImage' }),
    fullWidth: {
      type: 'radio' as const,
      label: 'Full Width (break out of container)',
      options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
      ],
    },
    backgroundBlur: {
      type: 'number' as const,
      label: 'Background Blur (0-20px)',
      min: 0,
      max: 20,
    },
    backgroundOverlay: {
      type: 'number' as const,
      label: 'Dark Overlay (0-80%)',
      min: 0,
      max: 80,
    },
    imagePosition: {
      type: 'radio' as const,
      label: 'Image Position',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
        { label: 'Top', value: 'top' },
        { label: 'Bottom', value: 'bottom' },
        { label: 'Background', value: 'background' },
      ],
    },
    contentAlign: {
      type: 'radio' as const,
      label: 'Content Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
    },
    overlayColor: createColorField({ label: 'Overlay Color' }),
    padding: { type: 'number' as const, label: 'Padding (px)', min: 0, max: 200 },
    maxWidth: { type: 'number' as const, label: 'Content Max Width (px)', min: 320, max: 1600 },
  },
  defaultProps: {
    logoImage: { url: '', prompt: '', mediaType: 'image' as const },
    tagline: { text: 'The Answer to Restful Nights', color: '#16a34a', fontSize: 14 },
    headline: { text: 'Discover DREAMHERO', color: '#1a1a1a', fontSize: 36 },
    subheadline: 'Experience the revolutionary sleep solution that transforms your nights into peaceful, restorative rest.',
    benefits: [],
    ctaText: { text: 'Shop Now', color: '#ffffff', fontSize: 18 },
    ctaColor: '#f97316',
    ctaLink: { type: 'custom' as const, url: '' },
    trustBadges: [],
    productImage: { url: '', prompt: '', mediaType: 'image' as const },
    backgroundImage: { url: '', prompt: '', mediaType: 'image' as const },
    fullWidth: false,
    backgroundBlur: 4,
    backgroundOverlay: 30,
    imagePosition: 'background' as const,
    contentAlign: 'left' as const,
    padding: 40,
    maxWidth: 1080,
  },
};
