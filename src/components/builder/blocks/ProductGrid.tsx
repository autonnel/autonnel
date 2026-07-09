import React from 'react';
import { createColorField } from '../ColorField';
import { createMediaField, getMediaDisplayStyle, type MediaFieldValue } from '../MediaField';
import { placeholderUrl, type PuckRenderExtras } from '../media-placeholder';
import { createTextField, getTextContent, getTextString, getTextStyle, hasText, scaledFontSize, type TextFieldValue } from '../TextField';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';

interface ProductCardItem {
  image?: string | MediaFieldValue;
  name?: string | TextFieldValue;
  price?: string | TextFieldValue;
  comparePrice?: string | TextFieldValue;
  badge?: string;
  link?: string | URLFieldValue;
}

export interface ProductGridProps {
  id?: string;
  title?: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
  products?: ProductCardItem[];
  columns?: number;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  showBorder?: boolean;
  imageAspectRatio?: 'square' | 'portrait' | 'landscape';
  padding?: number;
  viewAllLink?: string | URLFieldValue;
  viewAllText?: string;
}

const ASPECT_RATIO = {
  square: '1 / 1',
  portrait: '3 / 4',
  landscape: '4 / 3',
} as const;

function mediaUrl(media: string | MediaFieldValue | undefined, puck?: { isEditing?: boolean }) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.url || placeholderUrl(media.prompt, puck);
}

function uniqueGridId() {
  return `pcg-${Math.random().toString(36).slice(2, 8)}`;
}

function productSectionStyle(backgroundColor: string, padding: number): React.CSSProperties {
  return { backgroundColor, padding: `${padding}px 24px` };
}

function HeaderBlock({
  title,
  subtitle,
  viewAllLink,
  viewAllText,
}: Pick<ProductGridProps, 'title' | 'subtitle' | 'viewAllLink' | 'viewAllText'>) {
  const titleText = getTextContent(title);
  const subtitleText = getTextContent(subtitle);
  const viewAllUrl = getURLString(viewAllLink);
  if (!titleText && !viewAllUrl) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
      <div>
        {titleText && (
          <h2 style={{ ...getTextStyle(title, { color: '#1e293b', fontSize: 28 }), fontWeight: 700, marginBottom: subtitleText ? '6px' : '0', margin: 0 }}>
            {titleText}
          </h2>
        )}
        {subtitleText && <p style={{ ...getTextStyle(subtitle, { color: '#64748b', fontSize: 16 }), margin: '6px 0 0 0' }}>{subtitleText}</p>}
      </div>
      {viewAllUrl && (
        <a href={viewAllUrl} suppressHydrationWarning style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500, fontSize: scaledFontSize(15), whiteSpace: 'nowrap' }}>
          {viewAllText || 'View All'} &rarr;
        </a>
      )}
    </div>
  );
}

function Badge({ value }: { value: string }) {
  if (!value) return null;
  return (
    <span style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: value.toLowerCase() === 'sale' ? '#ef4444' : '#3b82f6', color: '#ffffff', fontSize: scaledFontSize(12), fontWeight: 600, padding: '4px 10px', borderRadius: '4px', textTransform: 'uppercase' }}>
      {value}
    </span>
  );
}

function ProductImage({
  product,
  ratio,
  url,
}: {
  product: ProductCardItem;
  ratio: ProductGridProps['imageAspectRatio'];
  url: string;
}) {
  return (
    <a href={getURLString(product.link) || '#'} suppressHydrationWarning style={{ display: 'block', position: 'relative' }}>
      <div style={{ aspectRatio: ASPECT_RATIO[ratio || 'square'], overflow: 'hidden', backgroundColor: '#f8fafc' }}>
        {url && (
          <img
            src={url}
            alt={getTextString(product.name)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease', ...getMediaDisplayStyle(product.image) }}
          />
        )}
      </div>
      <Badge value={product.badge || ''} />
    </a>
  );
}

function ProductInfo({ product }: { product: ProductCardItem }) {
  const productUrl = getURLString(product.link) || '#';
  const priceText = getTextContent(product.price);
  const compareText = getTextContent(product.comparePrice);
  const nameText = getTextContent(product.name);

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
      {hasText(product.name) && (
        <a
          href={productUrl}
          suppressHydrationWarning
          style={{ ...getTextStyle(product.name, { color: '#1e293b', fontSize: 15 }), textDecoration: 'none', fontWeight: 500, marginBottom: '8px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}
        >
          {nameText}
        </a>
      )}

      {(priceText || compareText) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
          {priceText && <span style={{ ...getTextStyle(product.price, { color: '#1e293b', fontSize: 16 }), fontWeight: 700 }}>{priceText}</span>}
          {compareText && <span style={{ ...getTextStyle(product.comparePrice, { color: '#9ca3af', fontSize: 14 }), textDecoration: 'line-through' }}>{compareText}</span>}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  ratio,
  cardBackgroundColor,
  showBorder,
  puck,
}: {
  product: ProductCardItem;
  ratio: ProductGridProps['imageAspectRatio'];
  cardBackgroundColor: string;
  showBorder: boolean;
  puck?: { isEditing?: boolean };
}) {
  return (
    <div style={{ backgroundColor: cardBackgroundColor, borderRadius: '8px', overflow: 'hidden', border: showBorder ? '1px solid #e5e7eb' : 'none', transition: 'box-shadow 0.2s ease', display: 'flex', flexDirection: 'column' }}>
      <ProductImage product={product} ratio={ratio} url={mediaUrl(product.image, puck)} />
      <ProductInfo product={product} />
    </div>
  );
}

function responsiveGridCss(gridId: string) {
  return (
    <style>{`
      @media (max-width: 1024px) {
        #${gridId} { grid-template-columns: repeat(3, 1fr) !important; }
      }
      @media (max-width: 768px) {
        #${gridId} { grid-template-columns: repeat(2, 1fr) !important; }
      }
    `}</style>
  );
}

export function ProductGrid({
  title,
  subtitle,
  products = [],
  columns = 4,
  backgroundColor = '#ffffff',
  cardBackgroundColor = '#ffffff',
  showBorder = true,
  imageAspectRatio = 'square',
  padding = 48,
  viewAllLink,
  viewAllText = 'View All',
  puck,
}: ProductGridProps & PuckRenderExtras) {
  const gridId = uniqueGridId();

  return (
    <section style={productSectionStyle(backgroundColor, padding)} className="product-card-grid">
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <HeaderBlock title={title} subtitle={subtitle} viewAllLink={viewAllLink} viewAllText={viewAllText} />
        {products.length > 0 && (
          <div id={gridId} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '24px' }}>
            {products.map((product, index) => (
              <ProductCard
                key={index}
                product={product}
                ratio={imageAspectRatio}
                cardBackgroundColor={cardBackgroundColor}
                showBorder={showBorder}
                puck={puck}
              />
            ))}
          </div>
        )}
      </div>
      {responsiveGridCss(gridId)}
    </section>
  );
}

const columnOptions = [2, 3, 4, 5].map((value) => ({ label: String(value), value }));
const aspectOptions = [
  { label: 'Square (1:1)', value: 'square' },
  { label: 'Portrait (3:4)', value: 'portrait' },
  { label: 'Landscape (4:3)', value: 'landscape' },
];

export const ProductGridConfig = {
  label: 'Product Card Grid',
  fields: {
    title: createTextField({ label: 'Section Title', defaultColor: '#1e293b', defaultFontSize: 28 }),
    subtitle: createTextField({ label: 'Subtitle', defaultColor: '#64748b', defaultFontSize: 16 }),
    products: {
      type: 'array' as const,
      label: 'Products',
      arrayFields: {
        image: createMediaField({ label: 'Product Image', aspectRatio: '1:1', fieldName: 'productCardImage' }),
        name: createTextField({ label: 'Product Name', defaultColor: '#1e293b', defaultFontSize: 15 }),
        price: createTextField({ label: 'Price', defaultColor: '#1e293b', defaultFontSize: 16 }),
        comparePrice: createTextField({ label: 'Compare Price (strikethrough)', defaultColor: '#9ca3af', defaultFontSize: 14 }),
        badge: { type: 'text' as const, label: 'Badge (e.g. Sale, New, Hot)' },
        link: createURLField({ label: 'Product Link', placeholder: 'Enter URL' }),
      },
      getItemSummary: (item: any) => getTextString(item?.name, 'Product'),
      defaultItemProps: {
        image: { url: '', prompt: '', mediaType: 'image' as const },
        name: { text: '', color: '#1e293b', fontSize: 15 },
        price: { text: '', color: '#1e293b', fontSize: 16 },
        comparePrice: { text: '', color: '#9ca3af', fontSize: 14 },
        badge: '',
        link: { type: 'custom' as const, url: '' },
      },
    },
    columns: { type: 'select' as const, label: 'Columns', options: columnOptions },
    imageAspectRatio: { type: 'select' as const, label: 'Image Aspect Ratio', options: aspectOptions },
    viewAllLink: createURLField({ label: 'View All Link', placeholder: 'Enter URL for "View All" link' }),
    viewAllText: { type: 'text' as const, label: 'View All Text', contentEditable: true },
    backgroundColor: createColorField({ label: 'Section Background' }),
    cardBackgroundColor: createColorField({ label: 'Card Background' }),
    showBorder: {
      type: 'radio' as const,
      label: 'Show Card Border',
      options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
    },
    padding: { type: 'number' as const, label: 'Section Padding (px)', min: 16, max: 96 },
  },
  defaultProps: {
    title: { text: 'Featured Products', color: '#1e293b', fontSize: 28 },
    subtitle: { text: '', color: '#64748b', fontSize: 16 },
    products: [],
    columns: 4,
    imageAspectRatio: 'square' as const,
    viewAllLink: { type: 'custom' as const, url: '' },
    viewAllText: 'View All',
    backgroundColor: '#ffffff',
    cardBackgroundColor: '#ffffff',
    showBorder: true,
    padding: 48,
  },
};

export default ProductGrid;
