import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TrackedOrder } from './OrderTrackingCard';
import { createColorField } from '../ColorField';
import { useTranslation } from '../LanguageContext';
import { createTextField, type TextFieldValue } from '../TextField';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { TrackedOrderDto } from '@/contracts/shop';
import {
  containerStyle,
  TrackingHeader,
  SearchForm,
  ErrorBanner,
  SearchResults,
} from './OrderTrackingPanel.parts';

export type { OrderItem, TrackedOrder } from './OrderTrackingCard';
export { statusConfig } from './OrderTrackingCard';

export interface OrderTrackingPanelProps {
  title?: string | TextFieldValue;
  subtitle?: string | ReactNode;
  emailLabel?: string;
  emailPlaceholder?: string;
  orderNumberLabel?: string;
  orderNumberPlaceholder?: string;
  submitButtonText?: string | TextFieldValue;
  submitButtonColor?: string;
  showOrderStatus?: boolean;
  showOrderItems?: boolean;
  showShippingAddress?: boolean;
  showPaymentInfo?: boolean;
  noOrdersMessage?: string | ReactNode;
  supportEmail?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  accentColor?: string;
}

type SearchState = {
  orders: TrackedOrder[] | null;
  loading: boolean;
  error: string | null;
  searched: boolean;
};

const DEMO_DAY = 24 * 60 * 60 * 1000;

function dateAgo(days: number) {
  return new Date(Date.now() - days * DEMO_DAY).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const demoOrders: TrackedOrder[] = [
  {
    id: 'demo-1',
    orderNumber: 'GEN-2024-001234',
    date: dateAgo(2),
    status: 'shipped',
    items: [{ id: 'item-1', name: 'Premium Product Bundle', variant: '3 Month Supply', price: 89.99, quantity: 1 }],
    total: 97.19,
    currency: 'USD',
    shippingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      address1: '123 Main Street',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'United States',
    },
    trackingNumber: '1Z999AA10123456784',
    trackingUrl: 'https://www.aftership.com/track?t=1Z999AA10123456784&c=UPS',
    trackingCompany: 'UPS',
    shipmentStatus: 'in_transit',
  },
  {
    id: 'demo-2',
    orderNumber: 'GEN-2024-001122',
    date: dateAgo(14),
    status: 'delivered',
    items: [{ id: 'item-2', name: 'Starter Kit', price: 49.99, quantity: 2 }],
    total: 107.98,
    currency: 'USD',
  },
];

function isEditorMode() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/edit') || window.location.pathname.includes('/preview');
}

function toTrackedOrder(dto: TrackedOrderDto): TrackedOrder {
  return { ...dto, status: dto.status as TrackedOrder['status'] };
}

function useOrderLookup(connectionError: string) {
  const [state, setState] = useState<SearchState>({
    orders: null,
    loading: false,
    error: null,
    searched: false,
  });

  const submit = async (email: string, orderNumber: string) => {
    if (!email.trim() || !orderNumber.trim()) return;

    setState({ orders: state.orders, loading: true, error: null, searched: true });

    if (isEditorMode()) {
      setTimeout(() => {
        setState({ orders: demoOrders, loading: false, error: null, searched: true });
      }, 800);
      return;
    }

    try {
      const data = await apiCall('GET /api/shop/order-tracking', null, {
        query: { email: email.trim(), orderNumber: orderNumber.trim(), domain: window.location.hostname },
      });
      setState({
        orders: (data.orders || []).map(toTrackedOrder),
        loading: false,
        error: null,
        searched: true,
      });
    } catch (error) {
      console.error('Order tracking error:', error);
      const message = error instanceof ApiCallError ? error.message : connectionError;
      setState({ orders: [], loading: false, error: message, searched: true });
    }
  };

  return { ...state, submit };
}

export function OrderTrackingPanel({
  title = 'Track Your Order',
  subtitle = 'Enter your email address to view your order history and tracking information.',
  emailLabel = 'Email Address',
  emailPlaceholder = 'Enter the email used for your order',
  orderNumberLabel = 'Order Number',
  orderNumberPlaceholder = 'Enter your order number',
  submitButtonText = 'Find My Orders',
  submitButtonColor = '#3b82f6',
  showOrderStatus = true,
  showOrderItems = true,
  showShippingAddress = true,
  showPaymentInfo = true,
  noOrdersMessage = 'No orders found for this email address. Please check and try again.',
  supportEmail = 'support@example.com',
  backgroundColor = '#ffffff',
  borderColor = '#e5e7eb',
  borderRadius = 16,
  padding = 32,
  accentColor = '#3b82f6',
}: OrderTrackingPanelProps) {
  const t = useTranslation();
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const search = useOrderLookup(t('orderTracking.connectionError'));

  return (
    <div style={containerStyle({ backgroundColor, borderColor, borderRadius, padding })} className="autonnel-order-tracking">
      <TrackingHeader title={title} subtitle={subtitle} accentColor={accentColor} />
      <SearchForm
        email={email}
        orderNumber={orderNumber}
        loading={search.loading}
        borderColor={borderColor}
        accentColor={accentColor}
        emailLabel={emailLabel}
        emailPlaceholder={emailPlaceholder}
        orderNumberLabel={orderNumberLabel}
        orderNumberPlaceholder={orderNumberPlaceholder}
        submitButtonText={submitButtonText}
        submitButtonColor={submitButtonColor}
        onEmailChange={setEmail}
        onOrderNumberChange={setOrderNumber}
        onSubmit={() => search.submit(email, orderNumber)}
      />
      <ErrorBanner error={search.error} />
      <SearchResults
        searched={search.searched}
        orders={search.orders}
        emptyMessage={noOrdersMessage}
        supportEmail={supportEmail}
        borderColor={borderColor}
        accentColor={accentColor}
        visibility={{ showOrderStatus, showOrderItems, showShippingAddress, showPaymentInfo }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const booleanOptions = [{ label: 'Yes', value: true }, { label: 'No', value: false }];

export const OrderTrackingPanelConfig = {
  label: 'Order Tracking',
  fields: {
    title: createTextField({ label: 'Title', defaultColor: '#111827', defaultFontSize: 24 }),
    subtitle: { type: 'richtext' as const, label: 'Subtitle', contentEditable: true },
    emailLabel: { type: 'text', label: 'Email Field Label', contentEditable: true },
    emailPlaceholder: { type: 'text', label: 'Email Placeholder' },
    orderNumberLabel: { type: 'text', label: 'Order Number Field Label', contentEditable: true },
    orderNumberPlaceholder: { type: 'text', label: 'Order Number Placeholder' },
    submitButtonText: createTextField({ label: 'Submit Button Text', defaultColor: '#ffffff', defaultFontSize: 15 }),
    submitButtonColor: createColorField({ label: 'Submit Button Color' }),
    showOrderStatus: { type: 'radio', label: 'Show Order Status', options: booleanOptions },
    showOrderItems: { type: 'radio', label: 'Show Order Items', options: booleanOptions },
    showShippingAddress: { type: 'radio', label: 'Show Shipping Address', options: booleanOptions },
    showPaymentInfo: { type: 'radio', label: 'Show Payment Info', options: booleanOptions },
    noOrdersMessage: { type: 'richtext' as const, label: 'No Orders Message', contentEditable: true },
    supportEmail: { type: 'text', label: 'Support Email' },
    backgroundColor: createColorField({ label: 'Background Color' }),
    borderColor: createColorField({ label: 'Border Color' }),
    borderRadius: { type: 'number', label: 'Border Radius', min: 0, max: 32 },
    padding: { type: 'number', label: 'Padding', min: 0, max: 64 },
    accentColor: createColorField({ label: 'Accent Color' }),
  },
  defaultProps: {
    title: { text: 'Track Your Order', color: '#111827', fontSize: 24 },
    subtitle: 'Enter your email address to view your order history and tracking information.',
    emailLabel: 'Email Address',
    emailPlaceholder: 'Enter the email used for your order',
    orderNumberLabel: 'Order Number',
    orderNumberPlaceholder: 'Enter your order number',
    submitButtonText: { text: 'Find My Orders', color: '#ffffff', fontSize: 15 },
    submitButtonColor: '#3b82f6',
    showOrderStatus: true,
    showOrderItems: true,
    showShippingAddress: true,
    showPaymentInfo: true,
    noOrdersMessage: 'No orders found for this email address. Please check and try again.',
    supportEmail: 'support@example.com',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 32,
    accentColor: '#3b82f6',
  },
  render: OrderTrackingPanel,
};

export default OrderTrackingPanel;
