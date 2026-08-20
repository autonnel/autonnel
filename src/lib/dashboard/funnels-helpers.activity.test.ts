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

describe('formatActivityEntry visitor badge and dwell', () => {
  it('drops the anid timestamp prefix so concurrent visitors get distinct badges', () => {
    const a = formatActivityEntry(row({ visitorId: 'mszjbn3m17pmxs75y9j' }));
    const b = formatActivityEntry(row({ visitorId: 'mszjb6m2b3wk7du1mwf' }));
    expect(a.visitor).toBe('17pmxs');
    expect(b.visitor).toBe('b3wk7d');
  });

  it('spreads colors across the palette instead of collapsing onto one hue', () => {
    const colors = new Set(
      Array.from({ length: 24 }, (_, i) =>
        formatActivityEntry(row({ visitorId: `mszjbn3m${i}7pmxs75y9j` })).visitorColor,
      ),
    );
    expect(colors.size).toBeGreaterThanOrEqual(8);
  });

  it('gives the same visitor the same color across rows', () => {
    const a = formatActivityEntry(row({ kind: 'page_view', visitorId: 'mszjbn3m17pmxs75y9j' }));
    const b = formatActivityEntry(row({ kind: 'page_leave', visitorId: 'mszjbn3m17pmxs75y9j' }));
    expect(b.visitorColor).toBe(a.visitorColor);
  });

  it('leaves the badge empty when the row has no visitor', () => {
    const entry = formatActivityEntry(row({ visitorId: null }));
    expect(entry.visitor).toBeNull();
    expect(entry.visitorColor).toBeNull();
  });

  it('shows dwell time only on page_leave rows', () => {
    expect(formatActivityEntry(row({ kind: 'page_leave', metadata: { timeOnPageMs: 2081 } })).duration).toBe('2.1s');
    expect(formatActivityEntry(row({ kind: 'page_leave', metadata: { timeOnPageMs: 587 } })).duration).toBe('587ms');
    expect(formatActivityEntry(row({ kind: 'page_leave', metadata: { timeOnPageMs: 125_000 } })).duration).toBe('2m05s');
    expect(formatActivityEntry(row({ kind: 'page_leave', metadata: {} })).duration).toBeNull();
    expect(formatActivityEntry(row({ kind: 'page_view', metadata: { timeOnPageMs: 2081 } })).duration).toBeNull();
  });
});
