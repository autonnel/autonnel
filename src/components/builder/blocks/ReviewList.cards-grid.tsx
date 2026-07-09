import React from 'react';
import type { ReviewListProps } from './ReviewList';
import { getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import { RichBody } from './RichBody';
import { getTextString, getTextStyle, hasText } from '../TextField';

function resolveAvatarUrl(media: string | MediaFieldValue | undefined): string {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || '';
}

export function ReviewsCardsGridView(props: ReviewListProps & {
  columns?: number;
  cardStyle?: 'plain' | 'bordered' | 'shadow';
  showAvatar?: boolean;
  showStars?: boolean;
  showName?: boolean;
  showRole?: boolean;
  accentColor?: string;
  cardBackground?: string;
  cardBorderColor?: string;
  quoteColor?: string;
  nameColor?: string;
  roleColor?: string;
}) {
  const {
    reviews = [],
    sectionTitle,
    subtitle,
    backgroundColor,
    columns = 3,
    cardStyle = 'bordered',
    showAvatar = true,
    showStars = true,
    showName = true,
    showRole = false,
    accentColor = '#f97316',
    cardBackground = '#ffffff',
    cardBorderColor = '#e5e7eb',
    quoteColor = '#374151',
    nameColor = '#111827',
    roleColor = '#6b7280',
  } = props;

  const cardBase: React.CSSProperties = {
    padding: 20,
    borderRadius: 12,
    backgroundColor: cardBackground,
    ...(cardStyle === 'bordered' && { border: `1px solid ${cardBorderColor}` }),
    ...(cardStyle === 'shadow' && { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }),
  };

  return (
    <section style={{ backgroundColor, padding: '40px 24px' }}>
      {hasText(sectionTitle) && (
        <h2 style={{ ...getTextStyle(sectionTitle, { color: '#1a1a1a', fontSize: 28 }), textAlign: 'center', fontWeight: 700, marginBottom: hasText(subtitle) ? 6 : 24 }}>
          {getTextString(sectionTitle)}
        </h2>
      )}
      {hasText(subtitle) && (
        <div style={{ ...getTextStyle(subtitle, { color: accentColor, fontSize: 13 }), textAlign: 'center', marginBottom: 24 }}>
          {getTextString(subtitle)}
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 14,
          maxWidth: 1000,
          margin: '0 auto',
        }}
        className="reviews-cards-grid"
      >
        {reviews.map((r, idx) => {
          const avatarUrl = resolveAvatarUrl(r.avatarImage);
          return (
          <div key={idx} style={cardBase}>
            {showStars && (
              <div style={{ color: accentColor, marginBottom: 10, letterSpacing: 2, fontSize: 12 }}>
                {'★'.repeat(Math.max(0, Math.min(5, r.rating ?? 5)))}
              </div>
            )}
            <RichBody
              value={r.content}
              style={{ marginBottom: 12, color: quoteColor, fontSize: 13, lineHeight: 1.55 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {showAvatar && avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={r.author}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', ...getMediaDisplayStyle(r.avatarImage) }}
                />
              )}
              <div>
                {showName && (
                  <div style={{ fontWeight: 700, fontSize: 12, color: nameColor }}>
                    {r.author}
                    {r.verified && <span style={{ color: accentColor }}> ✓</span>}
                  </div>
                )}
                {showRole && r.country && <div style={{ fontSize: 12, color: roleColor }}>{r.country}</div>}
              </div>
            </div>
          </div>
          );
        })}
      </div>
      <style>{`@media (max-width:768px){ .reviews-cards-grid{ grid-template-columns:1fr !important; } }`}</style>
    </section>
  );
}
