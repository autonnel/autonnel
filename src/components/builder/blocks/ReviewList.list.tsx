import React from 'react';
import { RichBody } from './RichBody';
import { type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { SectionOverlay, shouldShowOverlay } from '../SectionOverlay';
import { getTextContent, getTextStyle, hasText, scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';
import type { ReviewListProps } from './ReviewList';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';

type MediaInput = string | MediaFieldValue | undefined;

function resolveMediaSrc(source: MediaInput, puck?: { isEditing?: boolean }): string {
  if (!source) return '';
  if (typeof source === 'string') return source;
  if (source.url) return source.url;
  return placeholderUrl(source.prompt, puck);
}

export function getInitials(name: string | undefined): string {
  if (!name) return '??';
  const tokens = name.split(' ');
  const first = tokens[0];
  const second = tokens[1];
  if (tokens.length >= 2 && first && second) {
    return `${first[0]}${second[0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const US_FLAG = '\u{1F1FA}\u{1F1F8}';
const UK_FLAG = '\u{1F1EC}\u{1F1E7}';

export const countryFlags: Record<string, string> = {
  'United States': US_FLAG,
  USA: US_FLAG,
  'United Kingdom': UK_FLAG,
  UK: UK_FLAG,
  Canada: '\u{1F1E8}\u{1F1E6}',
  Australia: '\u{1F1E6}\u{1F1FA}',
  Germany: '\u{1F1E9}\u{1F1EA}',
  France: '\u{1F1EB}\u{1F1F7}',
};

const NEUTRAL_50 = '#9ca3af';
const NEUTRAL_70 = '#6b7280';
const NEUTRAL_BODY = '#374151';
const INK = '#1a1a1a';
const HAIRLINE = '#e5e7eb';
const VERIFIED = '#10b981';
const STAR_ON = '#eab308';

const wrapStyle: React.CSSProperties = { maxWidth: '900px', margin: '0 auto' };
const stackStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0' };
const rowSpread: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
};
const identityRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px' };
const nameLine: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const ratingRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '12px',
};
const starGroup: React.CSSProperties = { display: 'flex', gap: '2px' };

const STAR_COUNT = 5;

function Stars({ filled }: { filled: number }) {
  const cells = [];
  for (let s = 0; s < STAR_COUNT; s += 1) {
    cells.push(
      <span
        key={s}
        style={{ color: s < filled ? STAR_ON : HAIRLINE, fontSize: scaledFontSize(16) }}
      >
        {'★'}
      </span>,
    );
  }
  return <div style={starGroup}>{cells}</div>;
}

export function ReviewsListView({
  sectionTitle,
  reviews = [],
  backgroundColor = '#ffffff',
  puck,
}: ReviewListProps & PuckRenderExtras) {
  const t = useTranslation();
  const overlayVisible = shouldShowOverlay({});

  const headingStyle = getTextStyle(sectionTitle, { color: INK, fontSize: 42 });
  const lastIndex = reviews.length - 1;

  return (
    <SectionOverlay show={overlayVisible} sectionName="Customer Reviews">
      <div className="lp-section-padding" style={{ background: backgroundColor }}>
        <div style={wrapStyle}>
          {hasText(sectionTitle) ? (
            <h2
              className="lp-large-title"
              style={{
                ...headingStyle,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: '60px',
                fontStyle: 'italic',
              }}
            >
              {getTextContent(sectionTitle)}
            </h2>
          ) : null}

          <div style={stackStyle}>
            {reviews.map((review, idx) => {
              const photos = review.images ?? [];
              const hasPhotos = photos.length > 0;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '32px 0',
                    borderBottom: idx < lastIndex ? `1px solid ${HAIRLINE}` : 'none',
                  }}
                >
                  <div style={rowSpread}>
                    <div style={identityRow}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: HAIRLINE,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          color: NEUTRAL_70,
                          fontSize: scaledFontSize(16),
                        }}
                      >
                        {getInitials(review.author)}
                      </div>

                      <div>
                        <div style={nameLine}>
                          <span style={{ fontWeight: 600, color: INK }}>{review.author}</span>
                          {review.verified ? (
                            <span
                              style={{
                                color: VERIFIED,
                                fontSize: scaledFontSize(14),
                                fontWeight: 500,
                              }}
                            >
                              {t('reviews.verifiedBuyer')}
                            </span>
                          ) : null}
                        </div>
                        {review.country ? (
                          <div
                            style={{
                              fontSize: scaledFontSize(13),
                              color: NEUTRAL_70,
                              marginTop: '2px',
                            }}
                          >
                            {countryFlags[review.country] || '\u{1F30D}'} {review.country}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {review.date ? (
                      <div style={{ fontSize: scaledFontSize(14), color: NEUTRAL_50 }}>
                        {review.date}
                      </div>
                    ) : null}
                  </div>

                  <div style={ratingRow}>
                    <Stars filled={review.rating} />
                    {review.productName ? (
                      <span style={{ fontWeight: 600, color: INK, fontSize: scaledFontSize(15) }}>
                        {review.productName}
                      </span>
                    ) : null}
                  </div>

                  <RichBody
                    value={review.content}
                    style={{
                      color: NEUTRAL_BODY,
                      lineHeight: 1.7,
                      fontSize: scaledFontSize(15),
                      marginBottom: '20px',
                    }}
                  />

                  {hasPhotos ? (
                    <div className="lp-review-images">
                      {photos.map((img, j) => {
                        const src = resolveMediaSrc(img.image, puck);
                        if (!src) return null;
                        return (
                          <div
                            key={j}
                            style={{
                              width: '180px',
                              height: '135px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            }}
                          >
                            <img
                              src={src}
                              alt={`Review ${j + 1}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                ...getMediaDisplayStyle(img.image),
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SectionOverlay>
  );
}
