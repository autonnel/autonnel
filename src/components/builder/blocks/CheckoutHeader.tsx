import React from 'react';

import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import {
  createTextField,
  getTextContent,
  getTextString,
  getTextStyle,
  hasText,
  type TextFieldValue,
} from '../TextField';

type Media = string | MediaFieldValue | undefined;
type Text = string | TextFieldValue | undefined;

interface Benefit {
  icon: string | MediaFieldValue;
  title: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
}

export interface CheckoutHeaderProps {
  brandName?: string | TextFieldValue;
  brandLogo?: string | MediaFieldValue;
  productImage?: string | MediaFieldValue;
  productImageWidth?: number;
  productImageFill?: boolean;
  backgroundImage?: string | MediaFieldValue;
  benefits?: Benefit[];
  backgroundColor?: string;
}

const ROOT_PAD = '40px 24px';
const BENEFIT_CIRCLE = 48;
const BENEFIT_ICON = 32;

const responsiveCss = `
        @media (max-width: 768px) {
          .old-hero-benefits {
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            justify-content: center !important;
            gap: 8px 16px !important;
          }
          .old-hero-benefit-item {
            width: calc(50% - 8px) !important;
          }
          .old-hero-benefit-item:nth-child(n+3) {
            display: none !important;
          }
        }
      `;

function resolveMediaUrl(media: Media, puck?: { isEditing?: boolean }): string {
  if (!media) return '';
  if (typeof media === 'string') return media;
  if (media.url) return media.url;
  return placeholderUrl(media.prompt, puck);
}

function Branding({ brandName, brandLogo, puck }: { brandName: Text; brandLogo: Media; puck?: { isEditing?: boolean } }) {
  const logoSrc = resolveMediaUrl(brandLogo, puck);

  let content: React.ReactNode = null;
  if (logoSrc) {
    content = (
      <img
        src={logoSrc}
        alt={getTextString(brandName)}
        style={{ maxHeight: '60px', width: 'auto', ...getMediaDisplayStyle(brandLogo) }}
      />
    );
  } else if (hasText(brandName)) {
    const style = getTextStyle(brandName, { color: '#ffffff', fontSize: 36 });
    content = (
      <h1
        style={{
          fontSize: style.fontSize,
          fontWeight: 700,
          color: style.color,
          margin: 0,
          fontFamily: style.fontFamily || 'Georgia, serif',
        }}
      >
        {getTextContent(brandName)}
      </h1>
    );
  }

  return <div style={{ textAlign: 'center', marginBottom: '24px' }}>{content}</div>;
}

function ProductShot({
  productImage,
  width = 200,
  fillHeight = false,
  puck,
}: { productImage: Media; width?: number; fillHeight?: boolean; puck?: { isEditing?: boolean } }) {
  const src = resolveMediaUrl(productImage, puck);
  if (!src) return null;
  return (
    <div
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '32px',
      }}
    >
      <img
        src={src}
        alt="Product"
        style={fillHeight ? {
          height: '100%',
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))',
          ...getMediaDisplayStyle(productImage),
        } : {
          maxWidth: `${width}px`,
          width: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))',
          ...getMediaDisplayStyle(productImage),
        }}
      />
    </div>
  );
}

function BenefitCard({ icon, title, subtitle, puck }: Benefit & { puck?: { isEditing?: boolean } }) {
  const iconSrc = resolveMediaUrl(icon, puck);
  const titleStyle = getTextStyle(title, { color: '#ffffff', fontSize: 14 });
  const subtitleStyle = getTextStyle(subtitle, { color: '#ffffff', fontSize: 12 });
  const subtitleText = getTextContent(subtitle);

  return (
    <div
      className="old-hero-benefit-item"
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      {iconSrc ? (
        <div
          style={{
            width: `${BENEFIT_CIRCLE}px`,
            height: `${BENEFIT_CIRCLE}px`,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <img
            src={iconSrc}
            alt={getTextString(title)}
            style={{
              width: `${BENEFIT_ICON}px`,
              height: `${BENEFIT_ICON}px`,
              objectFit: 'contain',
              ...getMediaDisplayStyle(icon),
            }}
          />
        </div>
      ) : null}
      <div>
        <div style={{ fontSize: titleStyle.fontSize, fontWeight: 600, color: titleStyle.color }}>
          {getTextContent(title)}
        </div>
        {subtitleText ? (
          <div style={{ fontSize: subtitleStyle.fontSize, opacity: 0.8, color: subtitleStyle.color }}>
            {subtitleText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CheckoutHeader({
  brandName = 'VibeGorge®',
  brandLogo,
  productImage,
  productImageWidth = 200,
  productImageFill = false,
  backgroundImage,
  benefits = [],
  backgroundColor = '#0a3d4c',
  puck,
}: CheckoutHeaderProps & PuckRenderExtras) {
  const bgSrc = resolveMediaUrl(backgroundImage, puck);
  const background = bgSrc ? `url(${bgSrc}) center/cover no-repeat` : backgroundColor;

  return (
    <div
      className="old-hero-section"
      style={{
        background,
        padding: ROOT_PAD,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Branding brandName={brandName} brandLogo={brandLogo} puck={puck} />

      <ProductShot productImage={productImage} width={productImageWidth} fillHeight={productImageFill} puck={puck} />

      <div
        className="old-hero-benefits"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '24px',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        {benefits.map((benefit, index) => (
          <BenefitCard
            key={index}
            icon={benefit.icon}
            title={benefit.title}
            subtitle={benefit.subtitle}
            puck={puck}
          />
        ))}
      </div>

      <style>{responsiveCss}</style>
    </div>
  );
}

export const CheckoutHeaderConfig = {
  label: 'Old Hero Section',
  fields: {
    brandName: createTextField({ label: 'Brand Name', defaultColor: '#ffffff', defaultFontSize: 36 }),
    brandLogo: createMediaField({ label: 'Brand Logo', aspectRatio: '16:9', fieldName: 'oldHeroLogo' }),
    productImage: createMediaField({ label: 'Product Image', aspectRatio: '1:1', fieldName: 'oldHeroProduct' }),
    productImageWidth: {
      type: 'number' as const,
      label: 'Product Image Width (px)',
      min: 120,
      max: 560,
    },
    productImageFill: {
      type: 'radio' as const,
      label: 'Product Image Fills Panel Height',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    backgroundImage: createMediaField({ label: 'Background Image', aspectRatio: '16:9', fieldName: 'oldHeroBg' }),
    benefits: {
      type: 'array' as const,
      label: 'Benefits',
      arrayFields: {
        icon: createMediaField({ label: 'Icon Image', aspectRatio: '1:1', fieldName: 'oldHeroBenefitIcon' }),
        title: createTextField({ label: 'Title', defaultColor: '#ffffff', defaultFontSize: 14 }),
        subtitle: createTextField({ label: 'Subtitle', defaultColor: '#ffffff', defaultFontSize: 12 }),
      },
      getItemSummary: (item: any) => getTextContent(item?.title) || 'Benefit',
    },
    backgroundColor: {
      type: 'text' as const,
      label: 'Background Color',
    },
  },
  defaultProps: {
    brandName: { text: 'VibeGorge®', color: '#ffffff', fontSize: 36 },
    brandLogo: { url: '', prompt: '', mediaType: 'image' as const },
    productImage: { url: '', prompt: '', mediaType: 'image' as const },
    productImageWidth: 200,
    productImageFill: false,
    backgroundImage: { url: '', prompt: '', mediaType: 'image' as const },
    benefits: [
      { icon: { url: '', prompt: '', mediaType: 'image' as const }, title: { text: 'Tinnitus Relief', color: '#ffffff', fontSize: 14 }, subtitle: { text: 'Permanently', color: '#ffffff', fontSize: 12 } },
      { icon: { url: '', prompt: '', mediaType: 'image' as const }, title: { text: 'Enhance Focus &', color: '#ffffff', fontSize: 14 }, subtitle: { text: 'Mental Clarity', color: '#ffffff', fontSize: 12 } },
      { icon: { url: '', prompt: '', mediaType: 'image' as const }, title: { text: 'FDA Approved and', color: '#ffffff', fontSize: 14 }, subtitle: { text: 'Certified', color: '#ffffff', fontSize: 12 } },
      { icon: { url: '', prompt: '', mediaType: 'image' as const }, title: { text: 'Safe For All To Use', color: '#ffffff', fontSize: 14 }, subtitle: { text: '', color: '#ffffff', fontSize: 12 } },
    ],
    backgroundColor: '#0a3d4c',
  },
};

export default CheckoutHeader;
