
import React from 'react';
import type { ReactNode } from 'react';
import { createMediaField, type MediaFieldValue } from '../MediaField';
import { createColorField } from '../ColorField';
import { createTextField, type TextFieldValue } from '../TextField';
import { type PuckRenderExtras } from '../media-placeholder';
import { ReviewsListView } from './ReviewList.list';
import { ReviewsHeroView } from './ReviewList.hero';
import { ReviewsCarouselView } from './ReviewList.carousel';
import { ReviewsCardsGridView } from './ReviewList.cards-grid';

export interface ReviewImage {
  image?: string | MediaFieldValue;
}

export interface Review {
  author: string;
  country?: string;
  rating: number;
  productName?: string;
  content: string | ReactNode;
  verified?: boolean;
  date?: string;
  images?: ReviewImage[];
  avatarImage?: string | MediaFieldValue;
}

export interface ReviewListProps {
  theme: 'list' | 'hero' | 'carousel' | 'cards-grid';
  sectionTitle?: string | TextFieldValue;
  subtitle?: string | TextFieldValue;
  backgroundColor?: string;
  reviews?: Review[];
  backgroundImage?: string | MediaFieldValue;
  backgroundOverlay?: number;
  textColor?: string;
  images?: ReviewImage[];
  autoScroll?: boolean;
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
}

export function ReviewList(props: ReviewListProps & PuckRenderExtras) {
  switch (props.theme) {
    case 'hero':
      return <ReviewsHeroView {...props} />;
    case 'carousel':
      return <ReviewsCarouselView {...props} />;
    case 'cards-grid':
      return <ReviewsCardsGridView {...props} />;
    default:
      return <ReviewsListView {...props} />;
  }
}

export const ReviewListConfig = {
  fields: {
    theme: {
      type: 'radio' as const,
      label: 'Theme',
      options: [
        { label: 'List (stacked cards)', value: 'list' },
        { label: 'Hero (full-bleed carousel)', value: 'hero' },
        { label: 'Carousel (auto-scrolling UGC photo strip)', value: 'carousel' },
        { label: 'Cards Grid (3-col star cards)', value: 'cards-grid' },
      ],
    },
    sectionTitle: createTextField({ label: 'Section Title', defaultColor: '#1a1a1a', defaultFontSize: 42 }),
    subtitle: createTextField({ label: 'Subtitle (Carousel)', defaultColor: '#166534', defaultFontSize: 16 }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    backgroundImage: createMediaField({ label: 'Background Image (Hero)', aspectRatio: '16:9', fieldName: 'reviewsBackground' }),
    backgroundOverlay: {
      type: 'number' as const,
      label: 'Background Overlay % (Hero)',
      min: 0,
      max: 100,
    },
    textColor: createColorField({ label: 'Text Color (Hero)' }),
    autoScroll: {
      type: 'radio' as const,
      label: 'Auto Scroll (Carousel)',
      options: [
        { label: 'On', value: true },
        { label: 'Off', value: false },
      ],
    },
    columns: { type: 'number' as const, label: 'Columns (cards-grid)', min: 1, max: 4 },
    cardStyle: {
      type: 'radio' as const,
      label: 'Card Style (cards-grid)',
      options: [
        { label: 'Plain', value: 'plain' },
        { label: 'Bordered', value: 'bordered' },
        { label: 'Shadow', value: 'shadow' },
      ],
    },
    showAvatar: {
      type: 'radio' as const,
      label: 'Show Avatar',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showStars: {
      type: 'radio' as const,
      label: 'Show Stars',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showName: {
      type: 'radio' as const,
      label: 'Show Name',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showRole: {
      type: 'radio' as const,
      label: 'Show Role / Country',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    accentColor: createColorField({ label: 'Accent Color' }),
    cardBackground: createColorField({ label: 'Card Background (cards-grid)' }),
    cardBorderColor: createColorField({ label: 'Card Border (cards-grid)' }),
    quoteColor: createColorField({ label: 'Quote Color (cards-grid)' }),
    nameColor: createColorField({ label: 'Name Color (cards-grid)' }),
    roleColor: createColorField({ label: 'Role Color (cards-grid)' }),
    reviews: {
      type: 'array' as const,
      label: 'ReviewList',
      arrayFields: {
        author: { type: 'text' as const, label: 'Author Name (e.g. "Allegra C.")' },
        country: { type: 'text' as const, label: 'Country (e.g. "United States")' },
        rating: { type: 'number' as const, label: 'Rating (1-5)' },
        productName: { type: 'text' as const, label: 'Product Name', contentEditable: true },
        content: { type: 'richtext' as const, label: 'Review Content (50-100 words, authentic)', contentEditable: true },
        verified: {
          type: 'radio' as const,
          label: 'Verified Buyer',
          options: [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ],
        },
        date: { type: 'text' as const, label: 'Date (e.g. "10/11/2025")', contentEditable: true },
        avatarImage: createMediaField({ label: 'Avatar Image (hero theme)', aspectRatio: '1:1', fieldName: 'reviewAvatar' }),
        images: {
          type: 'array' as const,
          label: 'Review Images (500x375)',
          arrayFields: {
            image: createMediaField({ label: 'Review Image', aspectRatio: '4:3', fieldName: 'reviewImage' }),
          },
          getItemSummary: (_item: any, idx: number) => `Image ${idx + 1}`,
        },
      },
      getItemSummary: (item: any) => item?.author || 'Review',
    },
    images: {
      type: 'array' as const,
      label: 'User Photos (1080x1080)',
      arrayFields: {
        image: createMediaField({ label: 'User Photo', aspectRatio: '1:1', fieldName: 'reviewImage' }),
      },
      getItemSummary: (_item: any, index: number) => `Photo ${index + 1}`,
    },
  },
  defaultProps: {
    theme: 'list' as const,
    sectionTitle: { text: 'What people, just like you, are saying about Our Product', color: '#1a1a1a', fontSize: 42 },
    subtitle: { text: 'Join thousands of happy customers', color: '#166534', fontSize: 16 },
    backgroundColor: '#ffffff',
    backgroundImage: { url: '', prompt: '', mediaType: 'image' as const },
    backgroundOverlay: 40,
    textColor: '',
    autoScroll: true,
    reviews: [],
    images: [],
    columns: 3,
    cardStyle: 'bordered' as const,
    showAvatar: true,
    showStars: true,
    showName: true,
    showRole: false,
    accentColor: '#f97316',
    cardBackground: '#ffffff',
    cardBorderColor: '#e5e7eb',
    quoteColor: '#374151',
    nameColor: '#111827',
    roleColor: '#6b7280',
  },
};
