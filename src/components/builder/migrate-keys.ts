import type { Data } from '@puckeditor/core';

export const KEY_ALIAS: Record<string, string> = {
  HeroBanner: 'HeroPanel',
  PayPalExpress: 'PayPalExpressButton',
  Countdown: 'CountdownTimer',
  Reviews: 'ReviewList',
  RichText: 'RichTextBlock',
  CtaBanner: 'CallToActionBanner',
  SiteFooter: 'PageFooter',
  ImageTextSection: 'ImageTextSplit',
  ExpertSection: 'EndorsementPanel',
  ProductShowcase: 'ProductSpotlight',
  UsageSteps: 'HowToSteps',
  FAQSection: 'FaqAccordion',
  FloatingOrderBar: 'StickyCheckoutBar',
  CheckoutLayout: 'CheckoutGrid',
  AddressForm: 'ShippingAddressForm',
  PaymentForm: 'PaymentEntryForm',
  OrderSummary: 'OrderSummaryCard',
  CouponInput: 'CouponField',
  OrderDetails: 'OrderDetailPanel',
  AddToOrderButton: 'UpsellAddButton',
  OrderTracking: 'OrderTrackingPanel',
  SaleBanner: 'PromoBanner',
  StockCounter: 'StockMeter',
  CheckoutHeroSection: 'CheckoutHeader',
  DiscountBadge: 'SavingsBadge',
  ProductSelector: 'VariantSelector',
  BenefitsList: 'BenefitList',
  SimpleImage: 'ImageBlock',
  StandaloneAddressForm: 'StandaloneShippingForm',
  StickyLpHeader: 'StickyPageHeader',
  Columns: 'ColumnLayout',
  UpsellHeroSection: 'UpsellHeader',
  AnnouncementBar: 'NoticeBar',
  StoreNavBar: 'StoreHeader',
  HeroSlider: 'HeroCarousel',
  CategoryGrid: 'CategoryTiles',
  ProductCardGrid: 'ProductGrid',
  FeatureIconsBar: 'FeatureIconRow',
  MediaTileGrid: 'MediaGrid',
  SocialShareBar: 'SocialShareRow',
  CodeDisplay: 'CodeSnippet',
  ProgressStepper: 'StepProgress',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrateNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(migrateNode);
  }
  if (isPlainObject(node)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' && typeof value === 'string' && value in KEY_ALIAS) {
        out[key] = KEY_ALIAS[value];
      } else {
        out[key] = migrateNode(value);
      }
    }
    return out;
  }
  return node;
}

export function migratePuckData<T>(data: T): T {
  if (!isPlainObject(data)) return data;
  return migrateNode(data) as T;
}

export function migratePuckDataTyped(data: Data): Data {
  return migratePuckData(data);
}
