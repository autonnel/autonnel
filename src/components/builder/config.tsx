import React from 'react';
import type { Config } from '@puckeditor/core';
import { builderExtensions } from 'virtual:autonnel/builder-ext';
import { mergePuckComponents, mergeCategories } from './merge-extensions';
import { LanguageProvider } from './LanguageContext';
import { LANGUAGE_OPTIONS } from './translations';
import {
  HeroPanel, HeroPanelConfig,
  PayPalExpressButton, PayPalExpressButtonConfig,
  CountdownTimer, CountdownTimerConfig,
  ReviewList, ReviewListConfig,
  RichTextBlock, RichTextBlockConfig,
  CallToActionBanner, CallToActionBannerConfig,
  PageFooter, PageFooterConfig,
  ImageTextSplit, ImageTextSplitConfig,
  EndorsementPanel, EndorsementPanelConfig,
  ProductSpotlight, ProductSpotlightConfig,
  HowToSteps, HowToStepsConfig,
  FaqAccordion, FaqAccordionConfig,
  StickyCheckoutBar, StickyCheckoutBarConfig,
  CheckoutGrid, CheckoutGridConfig,
  ShippingAddressForm, ShippingAddressFormConfig,
  PaymentEntryForm, PaymentEntryFormConfig,
  OrderSummaryCard, OrderSummaryCardConfig,
  CouponField, CouponFieldConfig,
  OrderDetailPanel, OrderDetailPanelConfig,
  UpsellAddButton, UpsellAddButtonConfig,
  OrderTrackingPanel, OrderTrackingPanelConfig,
  PromoBanner, PromoBannerConfig,
  StockMeter, StockMeterConfig,
  CheckoutHeader, CheckoutHeaderConfig,
  SavingsBadge, SavingsBadgeConfig,
  VariantSelector, VariantSelectorConfig,
  BenefitList, BenefitListConfig,
  ImageBlock, ImageBlockConfig,
  StandaloneShippingForm, StandaloneShippingFormConfig,
  StickyPageHeader, StickyPageHeaderConfig,
  ColumnLayout, ColumnLayoutConfig,
  UpsellHeader, UpsellHeaderConfig,
  NoticeBar, NoticeBarConfig,
  StoreHeader, StoreHeaderConfig,
  HeroCarousel, HeroCarouselConfig,
  CategoryTiles, CategoryTilesConfig,
  ProductGrid, ProductGridConfig,
  FeatureIconRow, FeatureIconRowConfig,
  MediaGrid, MediaGridConfig,
  SocialShareRow, SocialShareRowConfig,
  CodeSnippet, CodeSnippetConfig,
  StepProgress, StepProgressConfig,
  UrgencyProofBar, UrgencyProofBarConfig,
  TrustBadgeRow, TrustBadgeRowConfig,
  PriceComparisonColumns, PriceComparisonColumnsConfig,
  ReferralCard, ReferralCardConfig,
} from './blocks';

export { getTemplateData } from './template-data';
export { SECTION_TO_COMPONENT } from './section-mappings';

const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const GOOGLE_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Nunito',
  'Raleway',
  'Source Sans 3',
  'DM Sans',
  'Playfair Display',
  'Merriweather',
  'Noto Sans',
  'Noto Sans SC',
];

const FONT_FAMILY_OPTIONS = [
  { label: 'System Default', value: 'system' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Nunito', value: 'Nunito' },
  { label: 'Raleway', value: 'Raleway' },
  { label: 'Source Sans 3', value: 'Source Sans 3' },
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Merriweather', value: 'Merriweather' },
  { label: 'Noto Sans', value: 'Noto Sans' },
  { label: 'Noto Sans SC (Chinese)', value: 'Noto Sans SC' },
];

const MAX_WIDTH_OPTIONS = [
  { label: 'Full Width', value: 'none' },
  { label: '1440px (Large)', value: '1440' },
  { label: '1280px (Desktop)', value: '1280' },
  { label: '1080px (Checkout/Thank You)', value: '1080' },
  { label: '960px (Narrow)', value: '960' },
  { label: '768px (Mobile Optimized)', value: '768' },
  { label: '680px (Compact)', value: '680' },
];

const FONT_SCALE_OPTIONS = [
  { label: '85%', value: '0.85' },
  { label: '90%', value: '0.9' },
  { label: '95%', value: '0.95' },
  { label: '100% (Default)', value: '1' },
  { label: '105%', value: '1.05' },
  { label: '110%', value: '1.1' },
  { label: '115%', value: '1.15' },
  { label: '120%', value: '1.2' },
  { label: '130%', value: '1.3' },
  { label: '140%', value: '1.4' },
  { label: '150%', value: '1.5' },
  { label: '160%', value: '1.6' },
  { label: '180%', value: '1.8' },
  { label: '200%', value: '2' },
];

const LABEL_FONT_WEIGHT_OPTIONS = [
  { label: 'Normal (400)', value: '400' },
  { label: 'Medium (500)', value: '500' },
  { label: 'Semi-Bold (600)', value: '600' },
  { label: 'Bold (700)', value: '700' },
];

interface RootProps {
  maxWidth?: string;
  fontFamily?: string;
  fontSize?: string;
  labelFontWeight?: string;
  language?: string;
  fontLinks?: string[];
  children?: React.ReactNode;
}

function resolveFontScale(fontSize?: string): number {
  const parsed = parseFloat(fontSize || '1');
  if (parsed > 5) return parsed / 16;
  return parsed;
}

function rootStyleBlock(scale: number, maxWidth: string): string {
  const pageMaxWidth = maxWidth === 'none' ? '100%' : `${maxWidth}px`;
  return `
              .landing-page {
                --font-scale: ${scale};
                --page-max-width: ${pageMaxWidth};
              }
              @media (max-width: 768px) {
                .landing-page { --font-scale: calc(${scale} * 0.92); }
              }
              @media (max-width: 480px) {
                .landing-page { --font-scale: calc(${scale} * 0.85); }
              }
              .puck-root-flex {
                display: flex;
                flex-direction: column;
              }
              .puck-full-width {
                width: 100vw;
                position: relative;
                left: 50%;
                transform: translateX(-50%);
              }
              .puck-full-width-inner {
                max-width: var(--page-max-width, 100%);
                margin-left: auto;
                margin-right: auto;
                width: 100%;
              }

              .autonnel-form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
              .lp-grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
              .lp-grid-expert { display: grid; grid-template-columns: 200px 1fr; gap: 40px; align-items: center; }
              .lp-grid-3-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
              .lp-grid-auto-cols { display: grid; gap: 32px; }
              .lp-grid-features { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
              .lp-image-first-mobile { order: 1; }
              .lp-content-second-mobile { order: 2; }
              .lp-headline { font-size: 48px; line-height: 1.1; }
              .lp-section-title { font-size: 36px; line-height: 1.2; }
              .lp-large-title { font-size: 42px; line-height: 1.2; }
              .lp-section-padding { padding: 80px 24px; }
              .lp-countdown { display: flex; justify-content: center; gap: 48px; }
              .lp-countdown-number { font-size: 72px; font-weight: bold; line-height: 1; }
              .lp-hide-mobile { display: block; }
              .lp-show-mobile { display: none; }
              .lp-ingredients-visual { position: relative; min-height: 500px; border-radius: 24px; padding: 40px; overflow: hidden; }
              .lp-footer-nav { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; }
              .lp-review-images { display: flex; gap: 12px; flex-wrap: wrap; }
              .lp-floating-cta { white-space: nowrap; }
              @media (max-width: 768px) {
                .lp-grid-2-cols { grid-template-columns: 1fr; gap: 32px; }
                .lp-grid-expert { grid-template-columns: 1fr; gap: 24px; }
                .lp-grid-expert .expert-image { margin: 0 auto; }
                .lp-grid-3-cols { grid-template-columns: 1fr; gap: 24px; }
                .lp-grid-auto-cols { grid-template-columns: 1fr !important; gap: 24px; }
                .lp-grid-features { grid-template-columns: 1fr; gap: 16px; }
                .lp-image-first-mobile { order: 1 !important; }
                .lp-content-second-mobile { order: 2 !important; }
                .lp-headline { font-size: 32px; line-height: 1.2; }
                .lp-section-title { font-size: 26px; line-height: 1.3; }
                .lp-large-title { font-size: 28px; line-height: 1.3; }
                .lp-section-padding { padding: 48px 16px; }
                .lp-countdown { gap: 24px; }
                .lp-countdown-number { font-size: 48px; }
                .lp-hide-mobile { display: none !important; }
                .lp-show-mobile { display: block !important; }
                .lp-ingredients-visual { min-height: 400px; padding: 24px; }
                .lp-ingredient-circle { width: 70px !important; height: 70px !important; }
                .lp-ingredient-label { font-size: 12px !important; max-width: 80px !important; }
                .lp-footer-nav { flex-direction: column; align-items: center; gap: 24px; }
                .lp-review-images>div { width: 140px !important; height: 105px !important; }
                .lp-floating-cta { padding: 12px 20px !important; font-size: 14px !important; }
                details summary { font-size: 16px !important; }
              }
              @media (max-width: 560px) {
                .autonnel-form-grid-2 { grid-template-columns: 1fr; }
              }
            `;
}

function RootWrapper({
  maxWidth = 'none',
  fontFamily = 'system',
  fontSize = '1',
  labelFontWeight = '700',
  language = 'en',
  fontLinks = [],
  children,
}: RootProps) {
  const isSystemFont = fontFamily === 'system';
  const resolvedFontFamily = isSystemFont
    ? SYSTEM_FONT_STACK
    : `"${fontFamily}", ${SYSTEM_FONT_STACK}`;
  const googleFontHref =
    !isSystemFont && GOOGLE_FONTS.includes(fontFamily)
      ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
          fontFamily,
        )}:wght@400;500;600;700&display=swap`
      : null;

  const scale = resolveFontScale(fontSize);
  const labelFw = labelFontWeight || '700';

  const outerStyle: React.CSSProperties = {
    fontFamily: resolvedFontFamily,
    ['--autonnel-label-fw' as string]: labelFw,
    overflowX: 'clip',
  };

  const containerStyle: React.CSSProperties =
    maxWidth === 'none'
      ? {}
      : { maxWidth: `${maxWidth}px`, margin: '0 auto', padding: '0 16px' };

  return (
    <LanguageProvider value={language || 'en'}>
      <div
        className="landing-page"
        data-max-width={maxWidth}
        data-language={language}
        style={outerStyle}
      >
        {googleFontHref && <link rel="stylesheet" href={googleFontHref} />}
        {fontLinks
          .filter((href) => typeof href === 'string' && href.startsWith('https://'))
          .map((href, i) => (
            <link key={i} rel="stylesheet" href={href} />
          ))}
        <style>{rootStyleBlock(scale, maxWidth)}</style>
        <div style={containerStyle} className="puck-root-flex">
          {children}
        </div>
      </div>
    </LanguageProvider>
  );
}

const rawPuckConfig = {
  components: {
    HeroPanel: { ...HeroPanelConfig, label: 'Hero Banner', render: HeroPanel },
    PayPalExpressButton: { ...PayPalExpressButtonConfig, label: 'PayPal Express', render: PayPalExpressButton },
    CountdownTimer: { ...CountdownTimerConfig, label: 'Countdown', render: CountdownTimer },
    ReviewList: { ...ReviewListConfig, label: 'Reviews', render: ReviewList },
    RichTextBlock: { ...RichTextBlockConfig, label: 'Rich Text', render: RichTextBlock },
    CallToActionBanner: { ...CallToActionBannerConfig, label: 'CTA Banner', render: CallToActionBanner },
    PageFooter: { ...PageFooterConfig, label: 'Site Footer', render: PageFooter },
    ImageTextSplit: { ...ImageTextSplitConfig, label: 'Image + Text', render: ImageTextSplit },
    EndorsementPanel: { ...EndorsementPanelConfig, label: 'Expert Endorsement', render: EndorsementPanel },
    ProductSpotlight: { ...ProductSpotlightConfig, label: 'Product Showcase', render: ProductSpotlight },
    HowToSteps: { ...HowToStepsConfig, label: 'Usage Steps', render: HowToSteps },
    FaqAccordion: { ...FaqAccordionConfig, label: 'FAQ', render: FaqAccordion },
    StickyCheckoutBar: { ...StickyCheckoutBarConfig, label: 'Floating Order Bar', render: StickyCheckoutBar },
    CheckoutGrid: { ...CheckoutGridConfig, label: 'Checkout Layout', render: CheckoutGrid },
    ShippingAddressForm: { ...ShippingAddressFormConfig, label: 'Address Form', render: ShippingAddressForm },
    PaymentEntryForm: { ...PaymentEntryFormConfig, label: 'Payment Form', render: PaymentEntryForm },
    OrderSummaryCard: { ...OrderSummaryCardConfig, label: 'Order Summary', render: OrderSummaryCard },
    CouponField: { ...CouponFieldConfig, label: 'Coupon Input', render: CouponField },
    OrderDetailPanel: { ...OrderDetailPanelConfig, label: 'Order Details', render: OrderDetailPanel },
    UpsellAddButton: { ...UpsellAddButtonConfig, label: 'Add to Order Button', render: UpsellAddButton },
    OrderTrackingPanel: { ...OrderTrackingPanelConfig, label: 'Order Tracking', render: OrderTrackingPanel },
    PromoBanner: { ...PromoBannerConfig, label: 'Sale Banner', render: PromoBanner },
    StockMeter: { ...StockMeterConfig, label: 'Stock Counter', render: StockMeter },
    CheckoutHeader: { ...CheckoutHeaderConfig, label: 'Checkout Hero', render: CheckoutHeader },
    SavingsBadge: { ...SavingsBadgeConfig, label: 'Discount Badge', render: SavingsBadge },
    VariantSelector: { ...VariantSelectorConfig, label: 'Product Selector', render: VariantSelector },
    BenefitList: { ...BenefitListConfig, label: 'Benefits List', render: BenefitList },
    ImageBlock: { ...ImageBlockConfig, label: 'Simple Image', render: ImageBlock },
    StandaloneShippingForm: { ...StandaloneShippingFormConfig, label: 'Standalone Address Form', render: StandaloneShippingForm },
    StickyPageHeader: { ...StickyPageHeaderConfig, label: 'Sticky LP Header', render: StickyPageHeader },
    ColumnLayout: { ...ColumnLayoutConfig, label: 'Columns (Two Column)', render: ColumnLayout },
    UpsellHeader: { ...UpsellHeaderConfig, label: 'Upsell Hero Section', render: UpsellHeader },
    NoticeBar: { ...NoticeBarConfig, label: 'Announcement Bar', render: NoticeBar },
    StoreHeader: { ...StoreHeaderConfig, label: 'Store Nav Bar', render: StoreHeader },
    HeroCarousel: { ...HeroCarouselConfig, label: 'Hero Slider', render: HeroCarousel },
    CategoryTiles: { ...CategoryTilesConfig, label: 'Category Grid', render: CategoryTiles },
    ProductGrid: { ...ProductGridConfig, label: 'Product Card Grid', render: ProductGrid },
    FeatureIconRow: { ...FeatureIconRowConfig, label: 'Feature Icons Bar', render: FeatureIconRow },
    MediaGrid: { ...MediaGridConfig, label: 'Media Tile Grid', render: MediaGrid },
    SocialShareRow: { ...SocialShareRowConfig, label: 'Social Share Bar', render: SocialShareRow },
    CodeSnippet: { ...CodeSnippetConfig, label: 'Code Display', render: CodeSnippet },
    StepProgress: { ...StepProgressConfig, label: 'Progress Stepper', render: StepProgress },
    UrgencyProofBar: { ...UrgencyProofBarConfig, label: 'Urgency + Proof Bar', render: UrgencyProofBar },
    TrustBadgeRow: { ...TrustBadgeRowConfig, label: 'Trust Badges', render: TrustBadgeRow },
    PriceComparisonColumns: { ...PriceComparisonColumnsConfig, label: 'Price Comparison', render: PriceComparisonColumns },
    ReferralCard: { ...ReferralCardConfig, label: 'Referral Card', render: ReferralCard },
  },
  categories: {
    common: {
      title: 'Common',
      defaultExpanded: false,
      components: [
        'PageFooter',
        'CountdownTimer',
        'ImageBlock',
        'RichTextBlock',
        'ColumnLayout',
        'MediaGrid',
        'SocialShareRow',
        'CodeSnippet',
        'StepProgress',
      ],
    },
    lp: {
      title: 'Landing Page',
      defaultExpanded: false,
      components: [
        'HeroPanel',
        'ReviewList',
        'ImageTextSplit',
        'EndorsementPanel',
        'ProductSpotlight',
        'HowToSteps',
        'FaqAccordion',
        'StickyCheckoutBar',
        'StickyPageHeader',
        'CallToActionBanner',
      ],
    },
    checkout: {
      title: 'Checkout',
      defaultExpanded: false,
      components: [
        'CheckoutGrid',
        'CheckoutHeader',
        'PromoBanner',
        'StockMeter',
        'UrgencyProofBar',
        'SavingsBadge',
        'VariantSelector',
        'BenefitList',
        'ShippingAddressForm',
        'StandaloneShippingForm',
        'OrderSummaryCard',
        'CouponField',
        'TrustBadgeRow',
        'PayPalExpressButton',
        'PaymentEntryForm',
        'PageFooter',
      ],
    },
    upsell: {
      title: 'Upsell',
      defaultExpanded: false,
      components: ['UpsellHeader', 'UpsellAddButton', 'PriceComparisonColumns'],
    },
    thankyou: {
      title: 'Thank You',
      defaultExpanded: false,
      components: ['OrderDetailPanel', 'ReferralCard'],
    },
    tracking: {
      title: 'Order Tracking',
      defaultExpanded: false,
      components: ['OrderTrackingPanel'],
    },
    store: {
      title: 'E-commerce Store',
      defaultExpanded: false,
      components: [
        'NoticeBar',
        'StoreHeader',
        'HeroCarousel',
        'CategoryTiles',
        'ProductGrid',
        'FeatureIconRow',
      ],
    },
  },
  root: {
    fields: {
      maxWidth: { type: 'select', label: 'Max Width', options: MAX_WIDTH_OPTIONS },
      fontFamily: { type: 'select', label: 'Font Family', options: FONT_FAMILY_OPTIONS },
      fontSize: { type: 'select', label: 'Font Scale', options: FONT_SCALE_OPTIONS },
      labelFontWeight: {
        type: 'select',
        label: 'Label Font Weight',
        options: LABEL_FONT_WEIGHT_OPTIONS,
      },
      language: {
        type: 'select',
        label: 'Page Language',
        options: LANGUAGE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      },
    },
    defaultProps: {
      maxWidth: 'none',
      fontFamily: 'system',
      fontSize: '1',
      labelFontWeight: '700',
      language: 'en',
    },
    render: RootWrapper,
  },
};

const mergedComponents = mergePuckComponents(
  rawPuckConfig.components as unknown as Config['components'],
  builderExtensions,
);
const mergedCategories = mergeCategories(rawPuckConfig.categories as never, builderExtensions);

export const puckConfig = {
  ...rawPuckConfig,
  components: mergedComponents,
  categories: mergedCategories,
} as unknown as Config;

export default puckConfig;

export const PUCK_COMPONENT_NAMES: string[] = Object.keys(mergedComponents);

export interface ComponentCatalogEntry {
  name: string;
  label: string;
  category: string;
  defaultProps: Record<string, unknown> | undefined;
  arrayItemKeys?: Record<string, string[]>;
}

// Array fields often have empty defaults, so defaultProps alone can't tell the AI
// agent which item keys the renderer reads — expose them from the field config.
function extractArrayItemKeys(fields: Record<string, any> | undefined): Record<string, string[]> | undefined {
  if (!fields) return undefined;
  const out: Record<string, string[]> = {};
  for (const [fieldName, def] of Object.entries(fields)) {
    if (def && def.type === 'array' && def.arrayFields && typeof def.arrayFields === 'object') {
      out[fieldName] = Object.keys(def.arrayFields);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function getComponentCatalog(): ComponentCatalogEntry[] {
  const categories = mergedCategories as Record<string, { components: string[] }>;
  const categoryOf = (name: string): string => {
    for (const [key, cat] of Object.entries(categories)) {
      if (cat.components.includes(name)) return key;
    }
    return 'other';
  };
  return PUCK_COMPONENT_NAMES.map((name) => {
    const comp = (mergedComponents as Record<string, { label?: unknown; defaultProps?: Record<string, unknown>; fields?: Record<string, unknown> }>)[name];
    return {
      name,
      label: typeof comp.label === 'string' ? comp.label : name,
      category: categoryOf(name),
      defaultProps: comp.defaultProps,
      arrayItemKeys: extractArrayItemKeys(comp.fields as Record<string, any> | undefined),
    };
  });
}
