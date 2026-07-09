import { describe, it, expect } from 'vitest';
import {
  registerPaymentProvider,
  getProviderByMethod,
  getProviderByDbKey,
  getAllProviders,
  getAllDbProviderKeys,
  getAllClickEventTypes,
  getAllSuccessEventTypes,
  getAllStatsColumns,
  getSuccessEventType,
  getErrorEventType,
  getPaymentDisplay,
  getPaymentDetailDisplay,
  getDbProviderForMethod,
  type PaymentProviderRegistration,
} from '@/lib/adapters/payment/registry';

const TWO_SUCCESS: PaymentProviderRegistration = {
  paymentMethod: '__multi_success__',
  dbProvider: 'MULTI_SUCCESS',
  eventTypes: {
    clickEvents: ['MS_CLICK_A'],
    successEvents: ['MS_OK_PRIMARY', 'MS_OK_SECONDARY'],
    errorEvent: 'MS_ERR',
  },
  display: { label: 'Multi', badgeClass: 'multi-badge' },
  displayName: 'Multi Success',
  formFields: [
    { key: 'token', label: 'Token', type: 'text' },
  ],
  details: {},
  statsColumns: [
    { key: 'msClick', label: 'MS', title: 'MS click', eventType: 'MS_CLICK_A', category: 'click' },
    { key: 'msOk', label: 'MS', title: 'MS success', eventType: 'MS_OK_PRIMARY', category: 'success' },
  ],
};

const PAYPAL_LIKE: PaymentProviderRegistration = {
  paymentMethod: 'paypal',
  dbProvider: 'PAYPAL_TEST',
  eventTypes: {
    clickEvents: ['PP_CLICK'],
    successEvents: ['PP_PRIMARY', 'PP_CC_SECONDARY'],
    errorEvent: 'PP_ERR',
  },
  display: { label: 'PayPal', badgeClass: '' },
  displayName: 'PayPal Test',
  formFields: [
    { key: 'clientId', label: 'Client ID', type: 'text' },
  ],
  details: {},
  statsColumns: [],
};

describe('payment provider registry — extended', () => {
  it('getAllDbProviderKeys returns all registered db keys', () => {
    registerPaymentProvider(TWO_SUCCESS);
    expect(getAllDbProviderKeys()).toContain('MULTI_SUCCESS');
  });

  it('getAllStatsColumns aggregates columns across providers', () => {
    registerPaymentProvider(TWO_SUCCESS);
    const cols = getAllStatsColumns();
    expect(cols.find((c) => c.key === 'msOk')).toBeDefined();
    expect(cols.find((c) => c.key === 'msClick')).toBeDefined();
  });

  it('getSuccessEventType uses paypal isCardPayment metadata to pick the secondary success event', () => {
    registerPaymentProvider(PAYPAL_LIKE);
    expect(getSuccessEventType('paypal')).toBe('PP_PRIMARY');
    expect(getSuccessEventType('paypal', { isCardPayment: true })).toBe('PP_CC_SECONDARY');
  });

  it('getSuccessEventType falls back to the primary success event for non-paypal providers', () => {
    registerPaymentProvider(TWO_SUCCESS);
    expect(getSuccessEventType('__multi_success__', { isCardPayment: true })).toBe('MS_OK_PRIMARY');
  });

  it('getProviderByMethod is case-insensitive', () => {
    registerPaymentProvider(TWO_SUCCESS);
    expect(getProviderByMethod('__MULTI_SUCCESS__')).toBe(TWO_SUCCESS);
  });

  it('all aggregator helpers include click and success entries from registered providers', () => {
    registerPaymentProvider(TWO_SUCCESS);
    expect(getAllClickEventTypes()).toContain('MS_CLICK_A');
    expect(getAllSuccessEventTypes()).toEqual(expect.arrayContaining(['MS_OK_PRIMARY', 'MS_OK_SECONDARY']));
  });

  it('getDbProviderForMethod and getProviderByDbKey round-trip', () => {
    registerPaymentProvider(TWO_SUCCESS);
    expect(getDbProviderForMethod('__multi_success__')).toBe('MULTI_SUCCESS');
    expect(getProviderByDbKey('MULTI_SUCCESS')).toBe(TWO_SUCCESS);
  });

  it('getPaymentDetailDisplay falls back to the raw key when no provider has the detail', () => {
    expect(getPaymentDetailDisplay('__nope_detail__').label).toBe('__nope_detail__');
  });

  it('getPaymentDisplay returns the gray fallback for unknown providers', () => {
    expect(getPaymentDisplay('__nope_provider__').badgeClass).toMatch(/gray/);
  });

  it('getAllProviders returns instances by reference', () => {
    registerPaymentProvider(TWO_SUCCESS);
    const all = getAllProviders();
    expect(all).toContain(TWO_SUCCESS);
  });
});
