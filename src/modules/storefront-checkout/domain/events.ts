export interface SaleDomainEvent<T = Record<string, unknown>> {
  type:
    | 'FunnelSessionStarted'
    | 'CartUpdated'
    | 'CheckoutSubmitted'
    | 'SalePaid'
    | 'OneClickUpsellPaid'
    | 'SaleHandedOff'
    | 'SaleHandoffFailed'
    | 'FunnelSessionAbandoned';
  payload: T;
}

export const saleEvents = {
  checkoutSubmitted(p: { saleRef: string; sessionId: string; hashedIdentity: string }): SaleDomainEvent {
    return { type: 'CheckoutSubmitted', payload: p };
  },
  salePaid(p: { saleRef: string; sessionId: string; hashedIdentity: string; providerChargeId: string }): SaleDomainEvent {
    return { type: 'SalePaid', payload: p };
  },
  saleHandedOff(p: { saleRef: string; backendRef: string; snapshot?: unknown }): SaleDomainEvent {
    return { type: 'SaleHandedOff', payload: p };
  },
  saleHandoffFailed(p: { saleRef: string }): SaleDomainEvent {
    return { type: 'SaleHandoffFailed', payload: p };
  },
  funnelSessionAbandoned(p: { sessionId: string; hashedIdentity: string | null }): SaleDomainEvent {
    return { type: 'FunnelSessionAbandoned', payload: p };
  },
};
