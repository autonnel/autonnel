import { describe, it, expect } from 'vitest';
import { catalogEventIdsForEnvelope } from './event-source-map';
import { MQEventType } from '@/lib/adapters/mq/types';

describe('catalogEventIdsForEnvelope', () => {
  it('passes through an envelope whose type is already a catalog id', () => {
    expect(catalogEventIdsForEnvelope(MQEventType.ANALYSIS_CONVERSION_COMPLETED)).toEqual([
      MQEventType.ANALYSIS_CONVERSION_COMPLETED,
    ]);
    expect(catalogEventIdsForEnvelope(MQEventType.ORDER_SHIPPED)).toEqual([MQEventType.ORDER_SHIPPED]);
  });

  it('maps a paid-on-creation order to order.paid (primary) then order.created', () => {
    expect(catalogEventIdsForEnvelope('OrderCreated')).toEqual([MQEventType.ORDER_PAID, MQEventType.ORDER_CREATED]);
  });

  it('maps the order lifecycle DDD types to their catalog ids', () => {
    expect(catalogEventIdsForEnvelope('OrderShipped')).toEqual([MQEventType.ORDER_SHIPPED]);
    expect(catalogEventIdsForEnvelope('OrderDelivered')).toEqual([MQEventType.ORDER_DELIVERED]);
    expect(catalogEventIdsForEnvelope('OrderRefunded')).toEqual([MQEventType.ORDER_REFUNDED]);
  });

  it('maps payment + checkout + upsell + cart domain events', () => {
    expect(catalogEventIdsForEnvelope('payment.captured')).toEqual([MQEventType.PAYMENT_SUCCESS]);
    expect(catalogEventIdsForEnvelope('payment.intent_created')).toEqual([MQEventType.PAYMENT_INITIATED]);
    expect(catalogEventIdsForEnvelope('payment.failed')).toEqual([MQEventType.PAYMENT_FAILED]);
    expect(catalogEventIdsForEnvelope('CheckoutSubmitted')).toEqual([MQEventType.CHECKOUT_STARTED]);
    expect(catalogEventIdsForEnvelope('SalePaid')).toEqual([MQEventType.CHECKOUT_COMPLETED]);
    expect(catalogEventIdsForEnvelope('OneClickUpsellPaid')).toEqual([MQEventType.UPSELL_ACCEPTED]);
    expect(catalogEventIdsForEnvelope('CartUpdated')).toEqual([MQEventType.CART_UPDATED]);
  });

  it('does NOT map payment.refund_issued (OrderRefunded is the single refund source, no double-notify)', () => {
    expect(catalogEventIdsForEnvelope('payment.refund_issued')).toEqual([]);
  });

  it('returns no catalog ids for domain events without a subscribable twin', () => {
    for (const t of ['SaleHandedOff', 'HandoffSucceeded', 'UserRegistered', 'AdAccountConnected', 'FunnelSessionStarted']) {
      expect(catalogEventIdsForEnvelope(t)).toEqual([]);
    }
  });
});
