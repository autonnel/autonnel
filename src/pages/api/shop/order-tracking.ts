import { defineRoute, ApiError } from '@/lib/api/define-route';
import { makeCustomerOrderTracking } from '@/composition/order-fulfillment-deps';
import {
  isValidEmail,
  type TrackedOrderView,
} from '@/modules/order-fulfillment/application/customer-order-tracking-read-model';
import type { TrackedOrderDto, TrackedOrderItemDto } from '@/contracts/shop';
import { getClientIp } from '@/lib/api/client-ip';
import { enforceRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/adapters/rate-limit';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'pending',
  PAID: 'paid',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partial_refund',
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function aftershipUrl(number: string | null, company: string | null): string | undefined {
  if (!number) return undefined;
  const params = new URLSearchParams({ t: number });
  if (company) params.set('c', company);
  return `https://www.aftership.com/track?${params.toString()}`;
}

function toItem(item: TrackedOrderView['items'][number]): TrackedOrderItemDto {
  return {
    id: item.externalRef,
    name: item.title || 'Product',
    price: item.unitPriceMinor / 100,
    quantity: item.quantity,
  };
}

function toDto(order: TrackedOrderView): TrackedOrderDto {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    date: dateLabel(order.createdAt),
    status: STATUS_LABELS[order.status] || 'paid',
    items: order.items.map(toItem),
    total: order.capturedTotalMinor / 100,
    currency: order.currencyCode || 'USD',
    trackingNumber: order.trackingNumber || undefined,
    trackingUrl: order.trackingUrl || aftershipUrl(order.trackingNumber, order.trackingCarrier),
    trackingCompany: order.trackingCarrier || undefined,
  };
}

// `domain` query param is kept only for wire compatibility.
export const GET = defineRoute('GET /api/shop/order-tracking', {}, async ({ query, locals, request }) => {
  const email = query.get('email');
  const orderNumber = query.get('orderNumber');
  if (!email) throw new ApiError(400, 'Email address is required');
  if (!query.get('domain')) throw new ApiError(400, 'Domain is required');
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) throw new ApiError(400, 'Invalid email format');
  // Email alone must not return any orders/PII — an order number is mandatory.
  if (!orderNumber || !orderNumber.trim()) throw new ApiError(400, 'Order number is required');

  // Throttle to defeat enumeration: cap per source IP and per queried email.
  const ip = getClientIp(request);
  const [byIp, byEmail] = await Promise.all([
    enforceRateLimit(rateLimitKey('order-tracking:ip', ip), RATE_LIMITS.ORDER_TRACKING_PER_IP),
    enforceRateLimit(rateLimitKey('order-tracking:email', normalizedEmail), RATE_LIMITS.ORDER_TRACKING_PER_EMAIL),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    throw new ApiError(429, 'Too many requests. Please try again later.');
  }

  const order = await makeCustomerOrderTracking(locals).track(normalizedEmail, orderNumber);
  return { orders: order ? [toDto(order)] : [] };
});
