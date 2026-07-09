import { builderExtensions } from 'virtual:autonnel/builder-ext';
import { mergeIslandLoaders } from './merge-extensions';

type ComponentLoader = () => Promise<React.ComponentType<any>>;

const coreLoaders: Record<string, ComponentLoader> = {
  ShippingAddressForm: () => import('./blocks/ShippingAddressForm').then(m => m.ShippingAddressForm),
  PaymentEntryForm: () => import('./blocks/PaymentEntryForm').then(m => m.PaymentEntryForm),
  PayPalExpressButton: () => import('./blocks/PayPalExpressButton').then(m => m.PayPalExpressButton),
  OrderSummaryCard: () => import('./blocks/OrderSummaryCard').then(m => m.OrderSummaryCard),
  CouponField: () => import('./blocks/CouponField').then(m => m.CouponField),
  StandaloneShippingForm: () => import('./blocks/StandaloneShippingForm').then(m => m.StandaloneShippingForm),

  UpsellAddButton: () => import('./blocks/UpsellAddButton').then(m => m.UpsellAddButton),

  CountdownTimer: () => import('./blocks/CountdownTimer').then(m => m.CountdownTimer),
  StickyCheckoutBar: () => import('./blocks/StickyCheckoutBar').then(m => m.StickyCheckoutBar),
  StockMeter: () => import('./blocks/StockMeter').then(m => m.StockMeter),
  StickyPageHeader: () => import('./blocks/StickyPageHeader').then(m => m.StickyPageHeader),

  VariantSelector: () => import('./blocks/VariantSelector').then(m => m.VariantSelector),

  OrderTrackingPanel: () => import('./blocks/OrderTrackingPanel').then(m => m.OrderTrackingPanel),
  OrderDetailPanel: () => import('./blocks/OrderDetailPanel').then(m => m.OrderDetailPanel),

  CodeSnippet: () => import('./blocks/CodeSnippet').then(m => m.CodeSnippet),
};

export const islandLoaders: Record<string, ComponentLoader> = mergeIslandLoaders(
  coreLoaders,
  builderExtensions,
);
