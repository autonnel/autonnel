import { describe, it, expect } from 'vitest';
import {
  registerPaymentProvider,
  getProviderByMethod,
  getProviderByDbKey,
  getAllProviders,
  getAllClickEventTypes,
  getAllSuccessEventTypes,
  getSuccessEventType,
  getErrorEventType,
  getPaymentDisplay,
  getPaymentDetailDisplay,
  getDbProviderForMethod,
  type PaymentProviderRegistration,
} from '@/lib/adapters/payment/registry';

const SMOKE_KEY = '__smoke_provider__';

const smokeRegistration: PaymentProviderRegistration = {
  paymentMethod: SMOKE_KEY,
  dbProvider: 'SMOKE_PROVIDER',
  eventTypes: {
    clickEvents: ['SMOKE_CLICK'],
    successEvents: ['SMOKE_SUCCESS'],
    errorEvent: 'SMOKE_ERROR',
  },
  display: { label: 'Smoke', badgeClass: 'smoke-badge' },
  displayName: 'Smoke Provider',
  formFields: [
    { key: 'apiKey', label: 'API Key', type: 'text' },
  ],
  details: {
    smoke_sub: { label: 'Smoke Sub', badgeClass: 'smoke-sub-badge' },
  },
  statsColumns: [
    {
      key: 'smokeSuccess',
      label: 'Smoke Success',
      title: 'Smoke provider success count',
      eventType: 'SMOKE_SUCCESS',
      category: 'success',
    },
  ],
};

describe('payment provider registry', () => {
  it('registers and looks up a provider by method and db key', () => {
    registerPaymentProvider(smokeRegistration);
    expect(getProviderByMethod(SMOKE_KEY)).toBe(smokeRegistration);
    expect(getProviderByMethod(SMOKE_KEY.toUpperCase())).toBe(smokeRegistration);
    expect(getProviderByDbKey('SMOKE_PROVIDER')).toBe(smokeRegistration);
    expect(getDbProviderForMethod(SMOKE_KEY)).toBe('SMOKE_PROVIDER');
  });

  it('returns undefined for unknown providers', () => {
    expect(getProviderByMethod('__definitely_not_registered__')).toBeUndefined();
    expect(getProviderByDbKey('__DEFINITELY_NOT_REGISTERED__')).toBeUndefined();
  });

  it('includes the smoke provider when listing all providers', () => {
    registerPaymentProvider(smokeRegistration);
    expect(getAllProviders().some((p) => p.paymentMethod === SMOKE_KEY)).toBe(true);
  });

  it('aggregates click and success event types across providers', () => {
    registerPaymentProvider(smokeRegistration);
    expect(getAllClickEventTypes()).toContain('SMOKE_CLICK');
    expect(getAllSuccessEventTypes()).toContain('SMOKE_SUCCESS');
  });

  it('resolves success/error event types for a registered method', () => {
    registerPaymentProvider(smokeRegistration);
    expect(getSuccessEventType(SMOKE_KEY)).toBe('SMOKE_SUCCESS');
    expect(getErrorEventType(SMOKE_KEY)).toBe('SMOKE_ERROR');
  });

  it('falls back to generic events for unknown methods', () => {
    expect(getSuccessEventType('__nope__')).toBe('PAYMENT_SUCCESS');
    expect(getErrorEventType('__nope__')).toBe('PAYMENT_ERROR');
  });

  it('returns display metadata with sensible fallback', () => {
    registerPaymentProvider(smokeRegistration);
    expect(getPaymentDisplay(SMOKE_KEY).label).toBe('Smoke');
    const fallback = getPaymentDisplay('__nope__');
    expect(fallback.label).toBe('__nope__');
    expect(fallback.badgeClass).toContain('gray');
  });

  it('returns payment detail info by detail key', () => {
    registerPaymentProvider(smokeRegistration);
    expect(getPaymentDetailDisplay('smoke_sub').label).toBe('Smoke Sub');
    expect(getPaymentDetailDisplay('__unknown_detail__').label).toBe('__unknown_detail__');
  });

  it('exposes displayName and formFields for all registered providers', async () => {
    // Force built-in registrations to load (idempotent — registry is a Map keyed by paymentMethod)
    await import('@/lib/adapters/payment/providers');
    const all = getAllProviders().filter((p) => p.paymentMethod !== SMOKE_KEY);
    expect(all.length).toBeGreaterThan(0);
    for (const provider of all) {
      expect(provider.displayName.length).toBeGreaterThan(0);
      expect(Array.isArray(provider.formFields)).toBe(true);
      expect(provider.formFields.length).toBeGreaterThan(0);
      for (const field of provider.formFields) {
        expect(field.key.length).toBeGreaterThan(0);
        expect(field.label.length).toBeGreaterThan(0);
        expect(['text', 'password']).toContain(field.type);
      }
    }
  }, 120_000);
});
