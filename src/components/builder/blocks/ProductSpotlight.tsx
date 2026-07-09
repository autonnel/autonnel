import React from 'react';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import { scaledFontSize } from '../TextField';
import { createColorField } from '../ColorField';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';

const FALLBACK_IMG =
  'data:image/svg+xml;base64,' +
  'PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAi' +
  'IGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+Cjxy' +
  'ZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMUU0MDdBIi8+CjxyZWN0' +
  'IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjI0MCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNEQzI2' +
  'MjYiIHJ4PSI4Ii8+CjxyZWN0IHg9IjMxMCIgeT0iNTAiIHdpZHRoPSIyNDAiIGhlaWdo' +
  'dD0iMzAwIiBmaWxsPSIjMjJDNTVFIiByeD0iOCIvPgo8dGV4dCB4PSIxNzAiIHk9Ijgw' +
  'IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+' +
  'QkVGT1JFPC90ZXh0Pgo8dGV4dCB4PSI0MzAiIHk9IjgwIiBmaWxsPSJ3aGl0ZSIgZm9u' +
  'dC1zaXplPSIxNCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QUZURVI8L3RleHQ+Cjwvc3Zn' +
  'Pg==';

type MediaProp = string | MediaFieldValue;

const resolveMediaUrl = (media: MediaProp | undefined, puck?: { isEditing?: boolean }): string => {
  if (!media) return '';
  if (typeof media === 'string') return media;
  if (media.url) return media.url;
  return placeholderUrl(media.prompt, puck);
};

export interface ProductSpotlightProps {
  headline?: string;
  productName: string;
  badgeText?: string;
  cardTitle?: string;
  productImage?: MediaProp;
  ctaText?: string;
  guaranteeText?: string;
  showPaymentIcons?: boolean;
  backgroundColor?: string;
  maxWidth?: number | string;
}

const GREEN_SHADOW_REST = '0 4px 20px rgba(22, 163, 74, 0.4)';
const GREEN_SHADOW_LIFT = '0 8px 30px rgba(22, 163, 74, 0.6)';

const PULSE_CSS = [
  '@keyframes pulse {',
  `  0% { transform: scale(1); box-shadow: ${GREEN_SHADOW_REST}; }`,
  `  50% { transform: scale(1.02); box-shadow: ${GREEN_SHADOW_LIFT}; }`,
  `  100% { transform: scale(1); box-shadow: ${GREEN_SHADOW_REST}; }`,
  '}',
  '.pulse-button { animation: pulse 2s ease-in-out infinite; }',
  '.pulse-button:hover {',
  '  animation: none;',
  '  transform: scale(1.02);',
  `  box-shadow: ${GREEN_SHADOW_LIFT};`,
  '}',
].join('\n');

const accentColor = '#3b82f6';

function Headline({ text, productName }: { text: string; productName: string }) {
  const segments = text.split(productName);
  const lastIdx = segments.length - 1;
  return (
    <>
      {segments.map((segment, i) => (
        <React.Fragment key={i}>
          {segment}
          {i !== lastIdx && <span style={{ color: accentColor }}>{productName}</span>}
        </React.Fragment>
      ))}
    </>
  );
}

const SHELL_STYLE: React.CSSProperties = {
  position: 'relative',
  background: '#1e3a5f',
  borderRadius: '16px',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const BADGE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#16a34a',
  color: 'white',
  padding: '8px 24px',
  borderRadius: '24px',
  fontSize: scaledFontSize(14),
  fontWeight: 600,
  zIndex: 10,
  whiteSpace: 'nowrap',
};

const CTA_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(135deg, #16a34a, #15803d)',
  color: 'white',
  padding: '18px 32px',
  borderRadius: '8px',
  border: 'none',
  fontSize: scaledFontSize(18),
  fontWeight: 'bold',
  cursor: 'pointer',
  marginBottom: '16px',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

export function ProductSpotlight(props: ProductSpotlightProps & PuckRenderExtras) {
  const {
    headline,
    productName,
    badgeText = 'Amazing Deal',
    cardTitle,
    productImage,
    ctaText = 'CHECK AVAILABILITY',
    guaranteeText = '30 Day Money-Back Guarantee',
    showPaymentIcons = true,
    backgroundColor = '#ffffff',
    maxWidth = 360,
  } = props;

  const widthCss = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  const src = resolveMediaUrl(productImage, props.puck) || FALLBACK_IMG;
  const mediaStyle = getMediaDisplayStyle(productImage);

  return (
    <SectionOverlay show={shouldShowOverlay({})} sectionName="Product Showcase">
      <div className="lp-section-padding" style={{ background: backgroundColor }}>
        <div style={{ maxWidth: widthCss, margin: '0 auto' }}>
          {headline ? (
            <h2
              className="lp-section-title"
              style={{
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: '48px',
                color: '#1a1a1a',
              }}
            >
              <Headline text={headline} productName={productName} />
            </h2>
          ) : null}

          <div style={{ position: 'relative', paddingTop: badgeText ? '20px' : 0 }}>
            {badgeText ? <div style={BADGE_STYLE}>{badgeText}</div> : null}

            <div style={SHELL_STYLE}>
              <div style={{ padding: '48px 32px 32px' }}>
                {cardTitle ? (
                  <h3
                    style={{
                      textAlign: 'center',
                      color: 'white',
                      fontSize: scaledFontSize(20),
                      fontWeight: 'bold',
                      marginBottom: '24px',
                    }}
                  >
                    {cardTitle}
                  </h3>
                ) : null}

                <div style={{ marginBottom: '24px', borderRadius: '8px', overflow: 'hidden' }}>
                  <img
                    src={src}
                    alt={productName}
                    style={{
                      width: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                      ...mediaStyle,
                    }}
                  />
                </div>

                <button className="pulse-button" style={CTA_STYLE}>
                  {ctaText}
                </button>

                {guaranteeText ? (
                  <p
                    style={{
                      textAlign: 'center',
                      color: 'white',
                      fontSize: scaledFontSize(14),
                      fontStyle: 'italic',
                      marginBottom: '20px',
                      opacity: 0.9,
                    }}
                  >
                    {guaranteeText}
                  </p>
                ) : null}

                {showPaymentIcons ? (
                  <div
                    style={{
                      background: 'white',
                      padding: '12px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <img
                      src="/images/cc-payments.svg"
                      alt="Accepted payment methods"
                      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <style>{PULSE_CSS}</style>
      </div>
    </SectionOverlay>
  );
}

export const ProductSpotlightConfig = {
  fields: {
    headline: {
      type: 'text' as const,
      label: 'Headline (use product name for highlight)',
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
    productName: {
      type: 'text' as const,
      label: 'Product Name (highlighted in headline)',
    },
    badgeText: {
      type: 'text' as const,
      label: 'Badge Text (e.g. "Amazing Deal")',
      contentEditable: true,
    },
    cardTitle: {
      type: 'text' as const,
      label: 'Card Title',
      contentEditable: true,
    },
    productImage: createMediaField({
      label: 'Product Image',
      aspectRatio: '3:2',
      fieldName: 'productImage',
    }),
    ctaText: {
      type: 'text' as const,
      label: 'Button Text',
      contentEditable: true,
    },
    guaranteeText: {
      type: 'text' as const,
      label: 'Guarantee Text',
      contentEditable: true,
    },
    showPaymentIcons: {
      type: 'radio' as const,
      label: 'Show Payment Icons',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    maxWidth: {
      type: 'number' as const,
      label: 'Max Width (px)',
    },
  },
  defaultProps: {
    headline: 'Get your ProductName today and get 70% off just for now!',
    backgroundColor: '#ffffff',
    productName: 'ProductName',
    badgeText: 'Amazing Deal',
    cardTitle: 'Get ProductName And Change Starts Today!',
    productImage: { url: '', prompt: '', mediaType: 'image' as const },
    ctaText: 'CHECK AVAILABILITY',
    guaranteeText: '30 Day Money-Back Guarantee',
    showPaymentIcons: true,
    maxWidth: 360,
  },
};
