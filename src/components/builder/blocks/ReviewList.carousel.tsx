import React from 'react';
import { type MediaFieldValue } from '../MediaField';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { getTextContent, getTextStyle, scaledFontSize } from '../TextField';
import type { ReviewListProps } from './ReviewList';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';

type MediaInput = string | MediaFieldValue | undefined;

const SCROLL_ANIM = 'reviewScroll 40s linear infinite';

const KEYFRAMES = [
  '@keyframes reviewScroll {',
  '  0% { transform: translateX(0); }',
  '  100% { transform: translateX(-50%); }',
  '}',
].join('\n');

const EMPTY_SLOT = { image: { url: '', prompt: '', mediaType: 'image' } };
const FALLBACK_COUNT = 6;

const TITLE_DEFAULTS = { color: '#166534', fontSize: 28 };
const SUBTITLE_DEFAULTS = { color: '#166534', fontSize: 16 };

function resolveMedia(value: MediaInput, puck?: { isEditing?: boolean }): string {
  if (typeof value === 'string') return value;
  if (!value) return '';
  if (value.url) return value.url;
  return placeholderUrl(value.prompt, puck);
}

const outerStyle = (bg: string): React.CSSProperties => ({
  padding: '60px 0',
  background: bg,
});

const headingWrap: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '40px',
  padding: '0 24px',
};

const viewportStyle: React.CSSProperties = { overflow: 'hidden' };

const trackStyle = (animate: boolean): React.CSSProperties => ({
  display: 'flex',
  gap: '20px',
  animation: animate ? SCROLL_ANIM : 'none',
  paddingLeft: '20px',
});

function slideStyle(url: string): React.CSSProperties {
  return {
    flexShrink: 0,
    width: '220px',
    height: '280px',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    position: 'relative',
    background: url ? `url(${url}) center/cover` : 'white',
  };
}

const blankSurface: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

const captionStyle: React.CSSProperties = {
  fontSize: scaledFontSize(12),
  color: '#94a3b8',
  marginTop: '12px',
  textAlign: 'center',
};

function PlaceholderArt({ label }: { label: string }) {
  return (
    <div style={blankSurface}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span style={captionStyle}>{label}</span>
    </div>
  );
}

export function ReviewsCarouselView({
  sectionTitle,
  subtitle,
  images = [],
  backgroundColor = '#ffffff',
  autoScroll = true,
  puck,
}: ReviewListProps & PuckRenderExtras) {
  const titleText = getTextContent(sectionTitle, '');
  const titleStyle = getTextStyle(sectionTitle, TITLE_DEFAULTS);
  const subText = getTextContent(subtitle, '');
  const subStyle = getTextStyle(subtitle, SUBTITLE_DEFAULTS);

  const slots = images.length > 0 ? images : Array(FALLBACK_COUNT).fill(EMPTY_SLOT);
  const loopCount = slots.length;
  const doubled = [...slots, ...slots];

  const hasHeading = Boolean(titleText || subText);

  return (
    <SectionOverlay show={shouldShowOverlay({})} sectionName="Review Carousel">
      <div style={outerStyle(backgroundColor)}>
        {hasHeading ? (
          <div style={headingWrap}>
            {titleText ? (
              <h2 style={{ ...titleStyle, fontWeight: 'bold', marginBottom: '8px' }}>
                {titleText}
              </h2>
            ) : null}
            {subText ? (
              <p style={{ ...subStyle, opacity: 0.8 }}>{subText}</p>
            ) : null}
          </div>
        ) : null}

        <div style={viewportStyle}>
          <div style={trackStyle(autoScroll)}>
            {doubled.map((slot, idx) => {
              const url = resolveMedia(slot.image, puck);
              return (
                <div key={idx} style={slideStyle(url)}>
                  {url ? null : (
                    <PlaceholderArt label={`User Photo ${(idx % loopCount) + 1}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <style>{KEYFRAMES}</style>
      </div>
    </SectionOverlay>
  );
}
