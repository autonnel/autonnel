import React from 'react';

import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { getTextContent, getTextStyle, hasText } from '../TextField';
import { getURLString } from '../URLField';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import type { CallToActionBannerProps } from './CallToActionBanner';

type MediaInput = string | MediaFieldValue | undefined;

function resolveMediaUrl(source: MediaInput, puck?: { isEditing?: boolean }): string {
  if (!source) {
    return '';
  }
  if (typeof source === 'string') {
    return source;
  }
  if (source.url) {
    return source.url;
  }
  return placeholderUrl(source.prompt, puck);
}

const EMPHASIS_COLOR_BY_WORD: Record<string, string> = {
  high: '#dc2626',
  limited: '#dc2626',
  low: '#16a34a',
};

const BOLD_SPLIT = /(\*\*[^*]+\*\*)/g;
const BOLD_CAPTURE = /^\*\*(.+)\*\*$/;

function RichSegment({ text, color }: { text: string; color: string }) {
  const chunks = text.split(BOLD_SPLIT);
  return (
    <span>
      {chunks.map((chunk, index) => {
        const captured = chunk.match(BOLD_CAPTURE);
        if (!captured) {
          return <span key={index}>{chunk}</span>;
        }
        const inner = captured[1];
        const emphasis = EMPHASIS_COLOR_BY_WORD[inner.toLowerCase()] ?? color;
        return (
          <strong key={index} style={{ color: emphasis, fontWeight: 700 }}>
            {inner}
          </strong>
        );
      })}
    </span>
  );
}

type PlainProps = Pick<
  CallToActionBannerProps,
  | 'headline'
  | 'subheadline'
  | 'ctaText'
  | 'ctaLink'
  | 'ctaColor'
  | 'ctaRadius'
  | 'backgroundColor'
  | 'padding'
  | 'maxWidth'
  | 'fullWidth'
  | 'badgeImage'
  | 'badgePosition'
  | 'badgeSize'
>;

export function PlainTheme(props: PlainProps & PuckRenderExtras) {
  const {
    headline,
    subheadline,
    ctaText,
    ctaLink,
    ctaColor = '#16a34a',
    ctaRadius = 6,
    backgroundColor = '#f1f5f9',
    padding = 80,
    maxWidth = 960,
    fullWidth = false,
    badgeImage,
    badgePosition = 'none',
    badgeSize = 56,
  } = props;

  const showHeading = hasText(headline);
  const heading = getTextContent(headline);
  const headingStyle = getTextStyle(headline, { color: '#0f3d2b', fontSize: 40 });
  const showSub = hasText(subheadline);
  const sub = getTextContent(subheadline);
  const subStyle = getTextStyle(subheadline, { color: '#ffffff', fontSize: 18 });
  const label = getTextContent(ctaText);
  const labelStyle = getTextStyle(ctaText, { color: '#ffffff', fontSize: 16 });
  const href = getURLString(ctaLink);
  const badgeSrc = resolveMediaUrl(badgeImage, props.puck);

  const buttonStyle: React.CSSProperties = {
    display: 'inline-block',
    background: ctaColor,
    padding: '16px 40px',
    borderRadius: `${ctaRadius}px`,
    fontWeight: 700,
    letterSpacing: '0.5px',
    ...labelStyle,
  };
  const button = <span style={buttonStyle}>{label}</span>;

  const badge = badgeSrc ? (
    <img
      src={badgeSrc}
      alt=""
      style={{
        width: badgeSize,
        height: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        ...getMediaDisplayStyle(badgeImage),
      }}
    />
  ) : null;

  const isSideBadge = !!badge && (badgePosition === 'left' || badgePosition === 'right');
  const isTopBadge = !!badge && badgePosition === 'top';

  const textGroup = (
    <>
      {isTopBadge ? <div style={{ marginBottom: 16 }}>{badge}</div> : null}
      {showHeading ? (
        <h2 style={{ ...headingStyle, fontWeight: 700, lineHeight: 1.25, margin: 0 }}>
          {heading}
        </h2>
      ) : null}
      {showSub ? (
        <p style={{ ...subStyle, margin: '12px 0 0 0', lineHeight: 1.5 }}>{sub}</p>
      ) : null}
    </>
  );

  const ctaBlock = hasText(ctaText) ? (
    <div style={{ marginTop: showHeading || showSub ? '40px' : 0 }}>
      {href ? (
        <a href={href} suppressHydrationWarning style={{ textDecoration: 'none' }}>
          {button}
        </a>
      ) : (
        button
      )}
    </div>
  ) : null;

  return (
    <section
      className={fullWidth ? 'puck-full-width' : undefined}
      style={{
        background: backgroundColor,
        padding: `${padding}px 24px`,
        textAlign: 'center',
      }}
    >
      <div
        className={fullWidth ? 'puck-full-width-inner' : undefined}
        style={{ maxWidth: `${maxWidth}px`, margin: '0 auto' }}
      >
        {isSideBadge ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              flexDirection: badgePosition === 'left' ? 'row' : 'row-reverse',
              flexWrap: 'wrap',
            }}
          >
            {badge}
            <div>{textGroup}</div>
          </div>
        ) : (
          textGroup
        )}
        {ctaBlock}
      </div>
    </section>
  );
}

type SaleProps = Pick<
  CallToActionBannerProps,
  | 'badgeText'
  | 'badgeColor'
  | 'taglineText'
  | 'headline'
  | 'headlineSuffix'
  | 'subheadline'
  | 'productImage'
  | 'ctaText'
  | 'ctaUrl'
  | 'ctaColor'
  | 'urgencyText'
  | 'guaranteeText'
  | 'backgroundColor'
  | 'cardBorderColor'
>;

function splitUrgency(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) {
    return [];
  }
  return raw
    .split('|')
    .map((piece) => piece.trim())
    .filter(Boolean);
}

export function SaleCardTheme(props: SaleProps & PuckRenderExtras) {
  const {
    badgeText,
    badgeColor = '#7c3aed',
    taglineText,
    headline,
    headlineSuffix,
    subheadline,
    productImage,
    ctaText,
    ctaUrl,
    ctaColor = '#4a6b2a',
    urgencyText,
    guaranteeText,
    backgroundColor = '#f7f7f2',
    cardBorderColor = '#d1d5c8',
  } = props;

  const showBadge = hasText(badgeText);
  const badge = getTextContent(badgeText);
  const badgeStyle = getTextStyle(badgeText, { color: '#ffffff', fontSize: 15 });
  const showTagline = hasText(taglineText);
  const tagline = getTextContent(taglineText);
  const taglineStyle = getTextStyle(taglineText, { color: '#4a6b2a', fontSize: 13 });
  const showHeading = hasText(headline);
  const heading = getTextContent(headline);
  const headingStyle = getTextStyle(headline, { color: '#2d5016', fontSize: 26 });
  const showSuffix = hasText(headlineSuffix);
  const suffix = getTextContent(headlineSuffix);
  const suffixStyle = getTextStyle(headlineSuffix, { color: '#1a1a1a', fontSize: 26 });
  const showDesc = hasText(subheadline);
  const desc = getTextContent(subheadline);
  const descStyle = getTextStyle(subheadline, { color: '#4b5563', fontSize: 15 });
  const label = getTextContent(ctaText);
  const labelStyle = getTextStyle(ctaText, { color: '#ffffff', fontSize: 17 });
  const urgency = getTextContent(urgencyText);
  const urgencyStyle = getTextStyle(urgencyText, { color: '#4b5563', fontSize: 13 });
  const showGuarantee = hasText(guaranteeText);
  const guarantee = getTextContent(guaranteeText);
  const guaranteeStyle = getTextStyle(guaranteeText, { color: '#6b7280', fontSize: 13 });
  const productSrc = resolveMediaUrl(productImage, props.puck);
  const href = getURLString(ctaUrl);

  const overlayVisible = shouldShowOverlay({});
  const urgencyParts = splitUrgency(urgency);
  const dividerColor = cardBorderColor;

  const badgeRibbon = showBadge ? (
    <div
      style={{
        textAlign: 'center',
        marginBottom: '-18px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          background: badgeColor,
          ...badgeStyle,
          padding: '8px 28px',
          borderRadius: '8px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {badge}
      </span>
    </div>
  ) : null;

  const productPane = productSrc ? (
    <div
      style={{
        flex: '1 1 220px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: '180px',
      }}
    >
      <img
        src={productSrc}
        alt="Product"
        style={{
          maxWidth: '100%',
          maxHeight: '320px',
          objectFit: 'contain',
          ...getMediaDisplayStyle(productImage),
        }}
      />
    </div>
  ) : null;

  const rule = <div style={{ flex: 1, borderTop: `1px solid ${dividerColor}` }} />;

  return (
    <SectionOverlay show={overlayVisible} sectionName="Sale CTA">
      <div style={{ background: backgroundColor, padding: '48px 20px' }}>
        {badgeRibbon}

        <div
          style={{
            border: `2px dashed ${cardBorderColor}`,
            borderRadius: '16px',
            padding: '40px 28px 32px',
            background: '#ffffff',
            maxWidth: '800px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '28px',
            }}
          >
            {productPane}

            <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
              {showTagline ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px',
                  }}
                >
                  {rule}
                  <span
                    style={{
                      ...taglineStyle,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {tagline}
                  </span>
                  {rule}
                </div>
              ) : null}

              <h2 style={{ margin: '0 0 12px 0', lineHeight: 1.2 }}>
                {showHeading ? (
                  <span
                    className="lp-large-title"
                    style={{ ...headingStyle, fontWeight: 800, display: 'block' }}
                  >
                    {heading}
                  </span>
                ) : null}
                {showSuffix ? (
                  <span
                    style={{
                      ...suffixStyle,
                      fontWeight: 900,
                      display: 'block',
                      marginTop: '2px',
                    }}
                  >
                    {suffix}
                  </span>
                ) : null}
              </h2>

              {showDesc ? (
                <p style={{ ...descStyle, lineHeight: 1.6, margin: '0 0 20px 0' }}>{desc}</p>
              ) : null}

              {hasText(ctaText) ? (
                <a
                  href={href || '#'}
                  style={{
                    display: 'inline-block',
                    background: ctaColor,
                    ...labelStyle,
                    padding: '14px 32px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    textAlign: 'center',
                    letterSpacing: '0.02em',
                    transition: 'transform 0.15s, opacity 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </a>
              ) : null}

              {urgencyParts.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginTop: '16px',
                    ...urgencyStyle,
                  }}
                >
                  {urgencyParts.map((part, index) => (
                    <React.Fragment key={index}>
                      {index > 0 ? (
                        <span
                          style={{
                            width: '1px',
                            height: '14px',
                            background: cardBorderColor,
                            display: 'inline-block',
                          }}
                        />
                      ) : null}
                      <span>
                        <RichSegment text={part} color={urgencyStyle.color || '#4b5563'} />
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              ) : null}

              {showGuarantee ? (
                <p style={{ ...guaranteeStyle, margin: '14px 0 0 0', fontStyle: 'italic' }}>
                  {guarantee}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </SectionOverlay>
  );
}
