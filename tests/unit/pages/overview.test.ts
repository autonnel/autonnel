import { describe, it, expect } from 'vitest';
import {
  computeDelta,
  bucketByHour,
  normalizeSparkline,
  formatCurrency,
  formatNumber,
  formatPercent,
  relativeTime,
  formatHms,
  aggregateIntegrations,
  countAttention,
  csvEscape,
  toCsv,
} from '@/lib/dashboard/overview-helpers';

describe('computeDelta', () => {
  it('returns 0% muted when both periods are zero', () => {
    expect(computeDelta(0, 0)).toEqual({ value: '0.0%', direction: 'up', tone: 'muted' });
  });
  it('returns +100% ok when previous was zero', () => {
    expect(computeDelta(10, 0)).toEqual({ value: '+100%', direction: 'up', tone: 'ok' });
  });
  it('flags growth as ok and direction up', () => {
    const r = computeDelta(112, 100);
    expect(r.direction).toBe('up');
    expect(r.tone).toBe('ok');
    expect(r.value).toBe('+12.0%');
  });
  it('flags decline as bad and direction down', () => {
    const r = computeDelta(80, 100);
    expect(r.direction).toBe('down');
    expect(r.tone).toBe('bad');
    expect(r.value).toBe('-20.0%');
  });
  it('inverts tone when invertTone is true (e.g. churn metric)', () => {
    expect(computeDelta(120, 100, { invertTone: true }).tone).toBe('bad');
    expect(computeDelta(80, 100, { invertTone: true }).tone).toBe('ok');
  });
});

describe('bucketByHour', () => {
  it('returns N empty buckets when no events', () => {
    const out = bucketByHour([], new Date('2026-04-24T12:00:00Z'), 24);
    expect(out).toHaveLength(24);
    expect(out.every((b) => b === 0)).toBe(true);
  });
  it('places events in the correct hour bucket', () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const events = [
      { createdAt: new Date('2026-04-23T13:30:00Z') },
      { createdAt: new Date('2026-04-24T11:45:00Z') },
      { createdAt: new Date('2026-04-24T11:55:00Z') },
    ];
    const out = bucketByHour(events, now, 24);
    expect(out[23]).toBe(2);
    expect(out.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it('ignores events outside the window', () => {
    const now = new Date('2026-04-24T12:00:00Z');
    const events = [{ createdAt: new Date('2026-04-22T00:00:00Z') }];
    expect(bucketByHour(events, now, 24).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('normalizeSparkline', () => {
  it('pads short arrays from the left with zeros', () => {
    expect(normalizeSparkline([3, 4], 6)).toEqual([0, 0, 0, 0, 3, 4]);
  });
  it('returns N zeros when input is empty', () => {
    expect(normalizeSparkline([], 6)).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('returns input untouched when long enough', () => {
    expect(normalizeSparkline([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('formatters', () => {
  it('formatCurrency', () => {
    expect(formatCurrency(1234.5)).toBe('$1,235');
    expect(formatCurrency(12.5)).toBe('$12.50');
    expect(formatCurrency(-7)).toBe('-$7.00');
  });
  it('formatNumber', () => {
    expect(formatNumber(248921)).toBe('248,921');
    expect(formatNumber(NaN)).toBe('0');
  });
  it('formatPercent', () => {
    expect(formatPercent(1, 4)).toBe('25.00%');
    expect(formatPercent(0, 0)).toBe('0.00%');
  });
  it('relativeTime', () => {
    const now = new Date('2026-04-24T12:00:00Z');
    expect(relativeTime(new Date('2026-04-24T11:59:30Z'), now)).toBe('30s ago');
    expect(relativeTime(new Date('2026-04-24T11:30:00Z'), now)).toBe('30m ago');
    expect(relativeTime(null)).toBe('never');
  });
  it('formatHms pads to HH:MM:SS in UTC', () => {
    expect(formatHms(new Date('2026-04-24T03:05:09Z'))).toBe('03:05:09');
  });
});

describe('aggregateIntegrations', () => {
  const NOW = new Date('2026-04-24T12:00:00Z');
  const SOON = new Date('2026-04-25T12:00:00Z').toISOString();

  it('returns empty array on fresh install', () => {
    const items = aggregateIntegrations({ adPlatforms: [], paymentConfigs: [], emailConfigs: [], sites: [] });
    expect(items).toEqual([]);
  });

  it('flags credentials expiring within 7 days as Renew/warn', () => {
    const items = aggregateIntegrations(
      {
        adPlatforms: [{ id: 'a1', name: 'Main', platform: 'FACEBOOK', isActive: true, credentials: { expiresAt: SOON } }],
        paymentConfigs: [],
        emailConfigs: [],
        sites: [],
      },
      NOW,
    );
    expect(items[0].statusLabel).toBe('Renew');
    expect(items[0].status).toBe('warn');
  });

  it('groups all 4 sources and labels e-commerce by site settings', () => {
    const items = aggregateIntegrations(
      {
        adPlatforms: [{ id: 'a1', name: 'Main', platform: 'TIKTOK', isActive: true, credentials: null }],
        paymentConfigs: [{ id: 'p1', name: 'Default', provider: 'STRIPE', isActive: true, credentials: { publishableKey: 'pk_live_abcdefghijklmn' } }],
        emailConfigs: [{ id: 'e1', name: 'Default', provider: 'SMTP', isActive: true, credentials: { host: 'smtp.example.com' } }],
        sites: [{ id: 's1', name: 'Store', settings: { ecommerce: { type: 'shopify', shopDomain: 'demo.myshopify.com' } } }],
      },
      NOW,
    );
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.kind).sort()).toEqual(['ad', 'ecommerce', 'email', 'payment']);
    const stripe = items.find((i) => i.kind === 'payment')!;
    expect(stripe.detail).toMatch(/^pk_live_/);
    const shopify = items.find((i) => i.kind === 'ecommerce')!;
    expect(shopify.detail).toBe('demo.myshopify.com');
  });

  it('countAttention counts warn+bad', () => {
    const items = aggregateIntegrations(
      {
        adPlatforms: [{ id: 'a1', name: 'Main', platform: 'FACEBOOK', isActive: true, credentials: { expiresAt: SOON } }],
        paymentConfigs: [{ id: 'p1', name: 'Default', provider: 'PAYPAL', isActive: true, credentials: null }],
        emailConfigs: [],
        sites: [],
      },
      NOW,
    );
    expect(countAttention(items)).toBe(1);
  });
});

describe('csv helpers', () => {
  it('csvEscape wraps and doubles quotes when needed', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvEscape(null)).toBe('');
  });
  it('toCsv emits header + rows', () => {
    const csv = toCsv(
      [{ id: 'f1', name: 'Funnel A' }, { id: 'f2', name: 'B,C' }],
      ['id', 'name'],
    );
    expect(csv.trim().split('\n')).toEqual(['id,name', 'f1,Funnel A', 'f2,"B,C"']);
  });
});
