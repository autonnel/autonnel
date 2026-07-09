import React from 'react';
import { createMediaField, type MediaFieldValue, getMediaDisplayStyle } from '../MediaField';
import { createURLField, type URLFieldValue, getURLString } from '../URLField';
import { createTextField, type TextFieldValue, getTextContent, getTextStyle } from '../TextField';
import { createColorField } from '../ColorField';

type TileType = 'image' | 'cta' | 'video';

interface Tile {
  tileType: TileType;
  image?: MediaFieldValue;
  video?: MediaFieldValue;
  poster?: MediaFieldValue;
  link?: URLFieldValue;
  title?: TextFieldValue;
  subtitle?: TextFieldValue;
  icon?: MediaFieldValue;
  url?: URLFieldValue;
  backgroundColor?: string;
}

export interface MediaGridProps {
  tiles?: Tile[];
  columns: 2 | 3 | 4 | 5 | 6;
  aspectRatio: '1:1' | '4:5' | '16:9' | '3:4';
  gap: number;
  tileBorderRadius: number;
  backgroundColor?: string;
}

const ASPECT_RATIO_MAP: Record<string, string> = {
  '1:1': '1 / 1',
  '4:5': '4 / 5',
  '16:9': '16 / 9',
  '3:4': '3 / 4',
};

export function MediaGrid({
  tiles = [],
  columns = 4,
  aspectRatio = '1:1',
  gap = 16,
  tileBorderRadius = 8,
  backgroundColor,
}: MediaGridProps) {
  return (
    <section style={{ backgroundColor, padding: '32px 16px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: `${gap}px`,
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {tiles.map((tile, idx) => (
          <div
            key={idx}
            style={{
              aspectRatio: ASPECT_RATIO_MAP[aspectRatio] ?? '1 / 1',
              borderRadius: tileBorderRadius,
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: tile.backgroundColor ?? '#f3f4f6',
            }}
          >
            {tile.tileType === 'image' && tile.image && (() => {
              const href = getURLString(tile.link) || '';
              const imageEl = (
                <img
                  src={tile.image.url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', ...getMediaDisplayStyle(tile.image) }}
                />
              );
              return href ? (
                <a href={href} style={{ display: 'block', width: '100%', height: '100%' }}>
                  {imageEl}
                </a>
              ) : (
                imageEl
              );
            })()}
            {tile.tileType === 'cta' && (
              <a
                href={getURLString(tile.url) || '#'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  padding: 16,
                  textAlign: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {tile.icon && (
                  <img
                    src={tile.icon.url}
                    alt=""
                    style={{ width: 32, height: 32, objectFit: 'contain', marginBottom: 8, ...getMediaDisplayStyle(tile.icon) }}
                  />
                )}
                {tile.title && <div style={getTextStyle(tile.title, { fontSize: 16 })}>{getTextContent(tile.title, '')}</div>}
                {tile.subtitle && <div style={getTextStyle(tile.subtitle, { fontSize: 13 })}>{getTextContent(tile.subtitle, '')}</div>}
              </a>
            )}
            {tile.tileType === 'video' && tile.video && (
              <video
                src={tile.video.url}
                poster={tile.poster?.url}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                muted
                loop
                playsInline
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export const MediaGridConfig = {
  fields: {
    columns: { type: 'number' as const, label: 'Columns', min: 2, max: 6 },
    aspectRatio: {
      type: 'radio' as const,
      label: 'Aspect Ratio',
      options: [
        { label: '1:1 (Square)', value: '1:1' },
        { label: '4:5 (Portrait)', value: '4:5' },
        { label: '16:9 (Landscape)', value: '16:9' },
        { label: '3:4 (Portrait wider)', value: '3:4' },
      ],
    },
    gap: { type: 'number' as const, label: 'Gap (px)', min: 0, max: 64 },
    tileBorderRadius: { type: 'number' as const, label: 'Tile Border Radius (px)', min: 0, max: 32 },
    backgroundColor: createColorField({ label: 'Background Color' }),
    tiles: {
      type: 'array' as const,
      label: 'Tiles',
      arrayFields: {
        tileType: {
          type: 'radio' as const,
          label: 'Tile Type',
          options: [
            { label: 'Image', value: 'image' },
            { label: 'CTA card', value: 'cta' },
            { label: 'Video', value: 'video' },
          ],
        },
        image: createMediaField({ label: 'Image (image tiles)', aspectRatio: '1:1', fieldName: 'tileImage' }),
        video: createMediaField({ label: 'Video (video tiles)', aspectRatio: '16:9', fieldName: 'tileVideo' }),
        poster: createMediaField({ label: 'Poster (video tiles)', aspectRatio: '16:9', fieldName: 'tilePoster' }),
        link: createURLField({ label: 'Link (image tiles)' }),
        title: createTextField({ label: 'Title (CTA tiles)', defaultColor: '#111827', defaultFontSize: 16 }),
        subtitle: createTextField({ label: 'Subtitle (CTA tiles)', defaultColor: '#6b7280', defaultFontSize: 13 }),
        icon: createMediaField({ label: 'Icon (CTA tiles)', aspectRatio: '1:1', fieldName: 'tileIcon' }),
        url: createURLField({ label: 'URL (CTA tiles)' }),
        backgroundColor: createColorField({ label: 'Tile Background' }),
      },
    },
  },
  defaultProps: {
    columns: 4,
    aspectRatio: '1:1',
    gap: 16,
    tileBorderRadius: 8,
    tiles: [],
  },
};

export default MediaGrid;
