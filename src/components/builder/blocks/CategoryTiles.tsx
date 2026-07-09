import React from 'react';
import { createColorField } from '../ColorField';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createTextField, getTextContent, getTextString, getTextStyle, hasText, type TextFieldValue } from '../TextField';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';

interface CategoryItem {
  image?: string | MediaFieldValue;
  label?: string | TextFieldValue;
  link?: string | URLFieldValue;
}

export interface CategoryTilesProps {
  id?: string;
  title?: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
  categories?: CategoryItem[];
  columns?: number;
  shape?: 'circle' | 'square' | 'rounded';
  imageSize?: number;
  backgroundColor?: string;
  padding?: number;
}


const SHAPE_RADIUS = {
  circle: '50%',
  rounded: '12px',
  square: '0',
} as const;

function mediaUrl(media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || placeholderUrl(media.prompt, puck);
}

function sectionStyle(backgroundColor: string, padding: number): React.CSSProperties {
  return { backgroundColor, padding: `${padding}px 24px` };
}

function gridStyle(columns: number): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: '24px',
    justifyItems: 'center',
  };
}

function HeaderText({ title, subtitle }: Pick<CategoryTilesProps, 'title' | 'subtitle'>) {
  const titleText = getTextContent(title);
  const subtitleText = getTextContent(subtitle);
  if (!titleText) return null;

  return (
    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
      <h2 style={{ ...getTextStyle(title, { color: '#1e293b', fontSize: 28 }), fontWeight: 700, marginBottom: subtitleText ? '8px' : '0' }}>
        {titleText}
      </h2>
      {subtitleText && <p style={{ ...getTextStyle(subtitle, { color: '#64748b', fontSize: 16 }), margin: 0 }}>{subtitleText}</p>}
    </div>
  );
}

function CategoryCard({
  item,
  index,
  imageSize,
  shape,
  puck,
}: {
  item: CategoryItem;
  index: number;
  imageSize: number;
  shape: CategoryTilesProps['shape'];
  puck?: { isEditing?: boolean };
}) {
  const image = mediaUrl(item.image, puck);

  return (
    <a href={getURLString(item.link) || '#'} suppressHydrationWarning style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', transition: 'transform 0.2s ease' }}>
      <div style={{ width: imageSize, height: imageSize, borderRadius: SHAPE_RADIUS[shape || 'circle'], overflow: 'hidden', border: '2px solid #e5e7eb', flexShrink: 0 }}>
        {image && (
          <img
            src={image}
            alt={getTextString(item.label)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', ...getMediaDisplayStyle(item.image) }}
          />
        )}
      </div>
      {hasText(item.label) && (
        <span style={{ ...getTextStyle(item.label, { color: '#1e293b', fontSize: 15 }), fontWeight: 600, textAlign: 'center' }}>
          {getTextContent(item.label)}
        </span>
      )}
    </a>
  );
}

function responsiveColumnsCss() {
  return (
    <style>{`
      @media (max-width: 768px) {
        .category-grid > div > div:last-child {
          grid-template-columns: repeat(2, 1fr) !important;
        }
      }
    `}</style>
  );
}

export function CategoryTiles({
  title = 'Shop by Category',
  subtitle,
  categories = [],
  columns = 4,
  shape = 'circle',
  imageSize = 150,
  backgroundColor = '#ffffff',
  padding = 48,
  puck,
}: CategoryTilesProps & PuckRenderExtras) {
  return (
    <section style={sectionStyle(backgroundColor, padding)} className="category-grid">
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <HeaderText title={title} subtitle={subtitle} />
        {categories.length > 0 && (
          <div style={gridStyle(columns)}>
            {categories.map((item, index) => (
              <CategoryCard key={index} item={item} index={index} imageSize={imageSize} shape={shape} puck={puck} />
            ))}
          </div>
        )}
      </div>
      {responsiveColumnsCss()}
    </section>
  );
}

export const CategoryTilesConfig = {
  label: 'Category Grid',
  fields: {
    title: createTextField({ label: 'Section Title', defaultColor: '#1e293b', defaultFontSize: 28 }),
    subtitle: createTextField({ label: 'Subtitle', defaultColor: '#64748b', defaultFontSize: 16 }),
    categories: {
      type: 'array' as const,
      label: 'Categories',
      arrayFields: {
        image: createMediaField({ label: 'Category Image', aspectRatio: '1:1', fieldName: 'categoryImage' }),
        label: createTextField({ label: 'Category Name', defaultColor: '#1e293b', defaultFontSize: 15 }),
        link: createURLField({ label: 'Category Link', placeholder: 'Enter URL' }),
      },
      getItemSummary: (item: any) => getTextString(item?.label, 'Category'),
      defaultItemProps: {
        image: { url: '', prompt: '', mediaType: 'image' as const },
        label: { text: '', color: '#1e293b', fontSize: 15 },
        link: { type: 'custom' as const, url: '' },
      },
    },
    columns: {
      type: 'select' as const,
      label: 'Columns',
      options: [3, 4, 5, 6].map((value) => ({ label: String(value), value })),
    },
    shape: {
      type: 'select' as const,
      label: 'Image Shape',
      options: [
        { label: 'Circle', value: 'circle' },
        { label: 'Square', value: 'square' },
        { label: 'Rounded', value: 'rounded' },
      ],
    },
    imageSize: { type: 'number' as const, label: 'Image Size (px)', min: 80, max: 300 },
    backgroundColor: createColorField({ label: 'Background Color' }),
    padding: { type: 'number' as const, label: 'Section Padding (px)', min: 16, max: 96 },
  },
  defaultProps: {
    title: { text: 'Shop by Category', color: '#1e293b', fontSize: 28 },
    subtitle: { text: 'Browse our popular categories', color: '#64748b', fontSize: 16 },
    categories: [],
    columns: 4,
    shape: 'circle' as const,
    imageSize: 150,
    backgroundColor: '#ffffff',
    padding: 48,
  },
};

export default CategoryTiles;
