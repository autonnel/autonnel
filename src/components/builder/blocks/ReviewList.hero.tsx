import React from 'react';
import { RichBody } from './RichBody';
import { type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { getTextContent, getTextStyle, hasText, scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';
import type { Review, ReviewListProps } from './ReviewList';
import { getInitials } from './ReviewList.list';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';

const STAR_COUNT = 5;
const AVATAR_SIZE = 200;
const GOLD = '#facc15';
const DIM_STAR = 'rgba(255,255,255,0.35)';
const SLIDE_ID = (n: number) => `cr-hero-slide-${n}`;

const resolveMediaUrl = (media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }): string => {
  if (typeof media === 'string') return media;
  if (!media) return '';
  if (media.url) return media.url;
  return placeholderUrl(media.prompt, puck);
};

const clampPercent = (n: number) => Math.min(100, Math.max(0, n)) / 100;

const trackCss = [
  '.cr-hero-track::-webkit-scrollbar { display: none; }',
  '.cr-hero-track { -ms-overflow-style: none; scrollbar-width: none; }',
].join('\n');

const styles = {
  overlay: (alpha: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    background: `rgba(15, 23, 42, ${alpha})`,
    pointerEvents: 'none',
  }),
  container: {
    position: 'relative',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 24px',
  } as React.CSSProperties,
  heading: {
    fontWeight: 700,
    textAlign: 'center',
    margin: 0,
    marginBottom: '48px',
    lineHeight: 1.25,
  } as React.CSSProperties,
  track: {
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollBehavior: 'smooth',
    gap: 0,
  } as React.CSSProperties,
  slide: {
    flex: '0 0 100%',
    scrollSnapAlign: 'center',
    padding: '8px 48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  } as React.CSSProperties,
  avatarWrap: {
    width: `${AVATAR_SIZE}px`,
    height: `${AVATAR_SIZE}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    background: '#e5e7eb',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  starsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
  } as React.CSSProperties,
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '32px',
  } as React.CSSProperties,
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.45)',
    display: 'inline-block',
  } as React.CSSProperties,
  arrow: (side: 'left' | 'right', color: string): React.CSSProperties => ({
    position: 'absolute',
    [side]: '8px',
    top: `${AVATAR_SIZE}px`,
    color,
    textDecoration: 'none',
    fontSize: scaledFontSize(40),
    lineHeight: 1,
    opacity: 0.8,
  }),
};

export function ReviewsHeroView({
  sectionTitle,
  reviews = [],
  backgroundColor = '#ffffff',
  backgroundImage,
  backgroundOverlay = 40,
  textColor,
  puck,
}: ReviewListProps & PuckRenderExtras) {
  const t = useTranslation();
  const fg = textColor || '#ffffff';
  const headingStyle = { ...getTextStyle(sectionTitle, { color: '#ffffff', fontSize: 42 }), ...styles.heading };
  const bgUrl = resolveMediaUrl(backgroundImage, puck);
  const overlayAlpha = clampPercent(backgroundOverlay);
  const showArrowsAndDots = reviews.length > 1;

  const sectionStyle: React.CSSProperties = {
    position: 'relative',
    background: backgroundColor,
    overflow: 'hidden',
    padding: '80px 0',
    color: fg,
  };
  if (bgUrl) {
    sectionStyle.backgroundImage = `url(${bgUrl})`;
    sectionStyle.backgroundSize = 'cover';
    sectionStyle.backgroundPosition = 'center';
    sectionStyle.backgroundRepeat = 'no-repeat';
  }

  const renderStars = (rating: number) =>
    Array.from({ length: STAR_COUNT }, (_, j) => (
      <span key={j} style={{ color: j < rating ? GOLD : DIM_STAR, fontSize: scaledFontSize(22) }}>
        {'★'}
      </span>
    ));

  const renderSlide = (review: Review, i: number) => {
    const avatarUrl = resolveMediaUrl(review.avatarImage, puck);
    return (
      <div key={i} id={SLIDE_ID(i)} style={styles.slide}>
        <div style={styles.avatarWrap}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={review.author}
              style={{ width: '100%', height: '100%', objectFit: 'cover', ...getMediaDisplayStyle(review.avatarImage) }}
            />
          ) : (
            <span style={{ fontSize: scaledFontSize(48), color: '#6b7280', fontWeight: 600 }}>
              {getInitials(review.author)}
            </span>
          )}
        </div>

        <div style={{ fontSize: scaledFontSize(28), fontWeight: 700, marginBottom: '12px' }}>
          {review.author}
        </div>

        <div style={styles.starsRow}>
          <div style={{ display: 'flex', gap: '4px' }}>{renderStars(review.rating)}</div>
          <span style={{ fontSize: scaledFontSize(16), fontWeight: 600 }}>
            {t('reviews.starRating', { rating: review.rating })}
          </span>
        </div>

        <RichBody
          value={review.content}
          style={{ maxWidth: '720px', fontSize: scaledFontSize(16), lineHeight: 1.7, color: fg }}
        />
      </div>
    );
  };

  return (
    <SectionOverlay show={shouldShowOverlay({})} sectionName="Customer Reviews">
      <section className="lp-customer-reviews-hero" style={sectionStyle}>
        {bgUrl && overlayAlpha > 0 && <div aria-hidden style={styles.overlay(overlayAlpha)} />}

        <div style={styles.container}>
          {hasText(sectionTitle) && <h2 style={headingStyle}>{getTextContent(sectionTitle)}</h2>}

          <div className="cr-hero-carousel" style={{ position: 'relative' }}>
            <div className="cr-hero-track" style={styles.track}>
              {reviews.map(renderSlide)}
            </div>

            {showArrowsAndDots && (
              <>
                <a href={`#${SLIDE_ID(0)}`} aria-label="Previous" style={styles.arrow('left', fg)}>
                  {'❮'}
                </a>
                <a href={`#${SLIDE_ID(reviews.length - 1)}`} aria-label="Next" style={styles.arrow('right', fg)}>
                  {'❯'}
                </a>
              </>
            )}

            {showArrowsAndDots && (
              <div style={styles.dotsRow}>
                {reviews.map((_, i) => (
                  <a key={i} href={`#${SLIDE_ID(i)}`} aria-label={`Go to review ${i + 1}`} style={styles.dot} />
                ))}
              </div>
            )}
          </div>
        </div>

        <style>{trackCss}</style>
      </section>
    </SectionOverlay>
  );
}
