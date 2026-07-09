import { createMediaField, type MediaFieldValue } from '../MediaField';
import { createColorField } from '../ColorField';
import { createTextField, type TextFieldValue } from '../TextField';
import { createURLField, type URLFieldValue } from '../URLField';
import { type PuckRenderExtras } from '../media-placeholder';
import { PlainTheme, SaleCardTheme } from './CallToActionBanner.themes';

export interface CallToActionBannerProps {
  theme: 'plain' | 'sale-card';

  ctaText?: string | TextFieldValue;
  ctaColor?: string;
  backgroundColor?: string;
  headline?: TextFieldValue | string;

  ctaLink?: string | URLFieldValue;
  ctaRadius?: number;
  padding?: number;
  maxWidth?: number;
  fullWidth?: boolean;

  badgeText?: string | TextFieldValue;
  badgeColor?: string;
  taglineText?: string | TextFieldValue;
  headlineSuffix?: string | TextFieldValue;
  subheadline?: TextFieldValue | string;
  productImage?: string | MediaFieldValue;
  ctaUrl?: URLFieldValue | string;
  urgencyText?: string | TextFieldValue;
  guaranteeText?: string | TextFieldValue;
  cardBorderColor?: string;

  badgeImage?: MediaFieldValue | string;
  badgePosition?: 'left' | 'right' | 'top' | 'none';
  badgeSize?: number;
}

export function CallToActionBanner(props: CallToActionBannerProps & PuckRenderExtras) {
  return props.theme === 'sale-card' ? (
    <SaleCardTheme {...props} />
  ) : (
    <PlainTheme {...props} />
  );
}

const THEME_OPTIONS = [
  { label: 'Plain (centered text + button)', value: 'plain' },
  { label: 'Sale Card (dashed card + image + urgency)', value: 'sale-card' },
];

const FULL_WIDTH_OPTIONS = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

const BADGE_POSITION_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
  { label: 'Top', value: 'top' },
  { label: 'None', value: 'none' },
];

export const CallToActionBannerConfig = {
  label: 'CTA Banner',
  fields: {
    theme: {
      type: 'radio' as const,
      label: 'Theme',
      options: THEME_OPTIONS,
    },
    headline: createTextField({ label: 'Headline', defaultColor: '#0f3d2b', defaultFontSize: 40 }),
    ctaText: createTextField({ label: 'Button Text', defaultColor: '#ffffff', defaultFontSize: 16 }),
    ctaColor: createColorField({ label: 'Button Color' }),
    backgroundColor: createColorField({ label: 'Background Color' }),
    ctaLink: createURLField({ label: 'Button Link (Plain)', placeholder: 'Enter URL' }),
    ctaRadius: {
      type: 'number' as const,
      label: 'Button Radius (Plain)',
      min: 0,
      max: 40,
    },
    padding: {
      type: 'number' as const,
      label: 'Vertical Padding (Plain)',
      min: 16,
      max: 160,
    },
    maxWidth: {
      type: 'number' as const,
      label: 'Content Max Width (Plain)',
      min: 320,
      max: 1600,
    },
    fullWidth: {
      type: 'radio' as const,
      label: 'Full Width Background (Plain)',
      options: FULL_WIDTH_OPTIONS,
    },
    badgeText: createTextField({ label: 'Top Badge Text (Sale Card)', defaultColor: '#ffffff', defaultFontSize: 15 }),
    badgeColor: createColorField({ label: 'Badge Color (Sale Card)' }),
    taglineText: createTextField({ label: 'Tagline (Sale Card)', defaultColor: '#4a6b2a', defaultFontSize: 13 }),
    headlineSuffix: createTextField({ label: 'Headline Suffix (Sale Card)', defaultColor: '#1a1a1a', defaultFontSize: 26 }),
    subheadline: createTextField({ label: 'Description (Sale Card)', defaultColor: '#4b5563', defaultFontSize: 15 }),
    productImage: createMediaField({ label: 'Product Image (Sale Card)', aspectRatio: '4:3', fieldName: 'saleCtaImage' }),
    ctaUrl: createURLField({ label: 'Button URL (Sale Card)' }),
    urgencyText: createTextField({ label: 'Urgency Text (Sale Card, use | to separate, **bold**)', defaultColor: '#4b5563', defaultFontSize: 13, inlineEditable: false }),
    guaranteeText: createTextField({ label: 'Guarantee Text (Sale Card)', defaultColor: '#6b7280', defaultFontSize: 13 }),
    cardBorderColor: createColorField({ label: 'Card Border Color (Sale Card)' }),
    badgeImage: createMediaField({ label: 'Badge Image', aspectRatio: '1:1', fieldName: 'ctaBadge' }),
    badgePosition: {
      type: 'radio' as const,
      label: 'Badge Position',
      options: BADGE_POSITION_OPTIONS,
    },
    badgeSize: {
      type: 'number' as const,
      label: 'Badge Width (px)',
      min: 24,
      max: 320,
    },
  },
  defaultProps: {
    theme: 'plain' as const,
    headline: { text: 'Limited-Time Offer - Secure Yours Today', color: '#0f3d2b', fontSize: 40 },
    ctaText: { text: 'SECURE YOURS TODAY', color: '#ffffff', fontSize: 16 },
    ctaColor: '#16a34a',
    backgroundColor: '#f1f5f9',
    ctaLink: { type: 'custom' as const, url: '' },
    ctaRadius: 6,
    padding: 80,
    maxWidth: 960,
    fullWidth: false,
    badgeText: { text: 'SPRING SALE', color: '#ffffff', fontSize: 15 },
    badgeColor: '#7c3aed',
    taglineText: { text: '🎁 BUY MORE, SAVE MORE', color: '#4a6b2a', fontSize: 13 },
    headlineSuffix: { text: 'FOR A LIMITED TIME ONLY!', color: '#1a1a1a', fontSize: 26 },
    subheadline: {
      text: "I was skeptical too. But with free shipping and a 30-day guarantee, there's nothing to lose.",
      color: '#4b5563',
      fontSize: 15,
    },
    productImage: { url: '', prompt: '', mediaType: 'image' as const },
    ctaUrl: { type: 'custom' as const, url: '' },
    urgencyText: { text: 'Sell-Out Risk: **High** | **FREE** shipping', color: '#4b5563', fontSize: 13 },
    guaranteeText: { text: 'Try it today with a 30-Day Money Back Guarantee!', color: '#6b7280', fontSize: 13 },
    cardBorderColor: '#d1d5c8',
    badgeImage: { url: '', prompt: '', mediaType: 'image' as const },
    badgePosition: 'none' as const,
    badgeSize: 56,
  },
};

export default CallToActionBanner;
