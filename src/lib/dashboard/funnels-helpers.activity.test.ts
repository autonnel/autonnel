import { describe, it, expect } from 'vitest';
import { formatActivityEntry, type RawActivityRow } from './funnels-helpers';

function row(overrides: Partial<RawActivityRow>): RawActivityRow {
  return {
    kind: 'page_view',
    stepId: null,
    pageId: null,
    pageSlug: null,
    url: null,
    metadata: null,
    occurredAt: new Date('2026-06-18T00:00:00Z'),
    ...overrides,
  };
}

describe('formatActivityEntry payload', () => {
  it('shows the page slug for navigation events', () => {
    const entry = formatActivityEntry(row({ kind: 'page_view', stepId: 'CUSTOM', pageSlug: 'summer-landing' }));
    expect(entry.text).toBe('Page view');
    expect(entry.payload).toBe('summer-landing');
  });

  it('shows the slug for checkout_view instead of the page type', () => {
    const entry = formatActivityEntry(row({ kind: 'checkout_view', stepId: 'CHECKOUT', pageSlug: 'main-checkout' }));
    expect(entry.payload).toBe('main-checkout');
  });

  it('falls back to the page type when no slug is resolvable', () => {
    const entry = formatActivityEntry(row({ kind: 'page_leave', stepId: 'CUSTOM', pageSlug: null }));
    expect(entry.payload).toBe('custom');
  });

  it('keeps provider payload for payment button clicks (PayPal initiate)', () => {
    const entry = formatActivityEntry(
      row({ kind: 'payment_button_click', pageSlug: 'main-checkout', metadata: { provider: 'paypal' } }),
    );
    expect(entry.text).toBe('Payment button click');
    expect(entry.payload).toBe('paypal');
  });
});
