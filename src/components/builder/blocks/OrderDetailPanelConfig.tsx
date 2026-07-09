import type { ComponentConfig } from '@puckeditor/core';
import { OrderDetailPanel, type OrderDetailPanelProps } from './OrderDetailPanel';

const yesNo = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

const toggleField = (label: string) => ({ type: 'radio' as const, label, options: yesNo });

export const OrderDetailPanelConfig: ComponentConfig<OrderDetailPanelProps> = {
  label: 'Order Details',
  render: OrderDetailPanel,
  defaultProps: {
    title: 'Order Confirmed!',
    subtitle: 'Thank you for your purchase. Your order has been received.',
    showOrderNumber: true,
    showOrderDate: true,
    showItems: true,
    showShippingAddress: true,
    showBillingAddress: false,
    showPaymentMethod: true,
    showSocialShare: false,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 32,
    accentColor: '#22c55e',
    variant: 'full',
    emptyStateMessage: 'Order not found. You cannot access this page directly.',
    emptyStateStyle: 'card',
  },
  fields: {
    title: { type: 'text', label: 'Title', contentEditable: true },
    subtitle: { type: 'richtext', label: 'Subtitle', contentEditable: true },
    showOrderNumber: toggleField('Show Order Number'),
    showOrderDate: toggleField('Show Order Date'),
    showItems: toggleField('Show Items'),
    showShippingAddress: toggleField('Show Shipping Address'),
    showBillingAddress: toggleField('Show Billing Address'),
    showPaymentMethod: toggleField('Show Payment Method'),
    showSocialShare: toggleField('Show Social Share'),
    backgroundColor: { type: 'text', label: 'Background Color' },
    borderColor: { type: 'text', label: 'Border Color' },
    borderRadius: { type: 'number', label: 'Border Radius', min: 0, max: 32 },
    padding: { type: 'number', label: 'Padding', min: 0, max: 64 },
    accentColor: { type: 'text', label: 'Accent Color' },
    variant: {
      type: 'radio',
      label: 'Layout',
      options: [
        { label: 'Full panel', value: 'full' },
        { label: 'Compact card', value: 'compact' },
      ],
    },
    surfaceColor: { type: 'text', label: 'Surface Color (compact)' },
    headerColor: { type: 'text', label: 'Header Row Color (compact)' },
    textColor: { type: 'text', label: 'Text Color (compact)' },
    mutedColor: { type: 'text', label: 'Muted Text Color (compact)' },
    savingColor: { type: 'text', label: 'Discount Color (compact)' },
    hairlineColor: { type: 'text', label: 'Image Placeholder Color (compact)' },
    badgeColor: { type: 'text', label: 'Qty Badge Color (compact)' },
    badgeTextColor: { type: 'text', label: 'Qty Badge Text Color (compact)' },
    totalLabel: { type: 'text', label: 'Total Label (compact)', contentEditable: true },
    emptyStateMessage: { type: 'text', label: 'Empty-state Message', contentEditable: true },
    emptyStateStyle: {
      type: 'radio',
      label: 'Empty-state Style',
      options: [
        { label: 'Card', value: 'card' },
        { label: 'Inline', value: 'inline' },
        { label: 'Minimal', value: 'minimal' },
      ],
    },
  },
};
