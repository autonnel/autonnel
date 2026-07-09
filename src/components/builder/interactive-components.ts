import { builderExtensions } from 'virtual:autonnel/builder-ext';
import { mergeInteractiveSet } from './merge-extensions';

const CHECKOUT_WIDGETS = [
  'ShippingAddressForm',
  'PaymentEntryForm',
  'PayPalExpressButton',
  'OrderSummaryCard',
  'CouponField',
  'StandaloneShippingForm',
] as const;

const CONVERSION_WIDGETS = [
  'UpsellAddButton',
  'CountdownTimer',
  'StickyCheckoutBar',
  'StockMeter',
  'StickyPageHeader',
  'VariantSelector',
] as const;

const ORDER_WIDGETS = [
  'OrderTrackingPanel',
  'OrderDetailPanel',
] as const;

const MISC_WIDGETS = [
  'CodeSnippet',
] as const;

const widgetIds = [
  ...CHECKOUT_WIDGETS,
  ...CONVERSION_WIDGETS,
  ...ORDER_WIDGETS,
  ...MISC_WIDGETS,
];

const coreInteractive = new Set<string>(widgetIds);

export const INTERACTIVE_COMPONENTS = mergeInteractiveSet(coreInteractive, builderExtensions);
