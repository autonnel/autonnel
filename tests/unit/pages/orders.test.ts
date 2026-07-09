import { describe, it, expect } from 'vitest';
import {
  aggregateOrderKpi,
  aggregateEmailKpi,
  filterOrderRows,
  paginate,
  pageNumbers,
  statusTone,
  statusBadgeClasses,
  prettyTemplateType,
  prettyPaymentMethod,
  formatMoney,
} from '@/lib/dashboard/orders-helpers';

const NOW = new Date('2026-04-24T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('aggregateOrderKpi', () => {
  it('returns zeros on empty input', () => {
    const k = aggregateOrderKpi({ orders: [], now: NOW });
    expect(k.total24h).toBe(0);
    expect(k.paid24h).toBe(0);
    expect(k.pending24h).toBe(0);
    expect(k.refunded24h).toBe(0);
  });

  it('buckets orders into current 24h vs prior 24h windows', () => {
    const k = aggregateOrderKpi({
      now: NOW,
      orders: [
        { status: 'PAID', createdAt: new Date(NOW.getTime() - 1 * HOUR) },
        { status: 'PAID', createdAt: new Date(NOW.getTime() - 5 * HOUR) },
        { status: 'PENDING', createdAt: new Date(NOW.getTime() - 10 * HOUR) },
        { status: 'REFUNDED', createdAt: new Date(NOW.getTime() - 12 * HOUR) },
        { status: 'PARTIALLY_REFUNDED', createdAt: new Date(NOW.getTime() - 20 * HOUR) },
        // prior 24h
        { status: 'PAID', createdAt: new Date(NOW.getTime() - 30 * HOUR) },
        { status: 'PENDING', createdAt: new Date(NOW.getTime() - 40 * HOUR) },
        // outside window
        { status: 'PAID', createdAt: new Date(NOW.getTime() - 100 * HOUR) },
      ],
    });
    expect(k.total24h).toBe(5);
    expect(k.paid24h).toBe(2);
    expect(k.pending24h).toBe(1);
    expect(k.refunded24h).toBe(2);
    expect(k.totalPrev24h).toBe(2);
    expect(k.paidPrev24h).toBe(1);
    expect(k.pendingPrev24h).toBe(1);
  });

  it('accepts ISO string createdAt', () => {
    const k = aggregateOrderKpi({
      now: NOW,
      orders: [{ status: 'PAID', createdAt: new Date(NOW.getTime() - HOUR).toISOString() }],
    });
    expect(k.paid24h).toBe(1);
  });
});

describe('aggregateEmailKpi', () => {
  it('counts pending/sent/failed and avg attempts before success', () => {
    const k = aggregateEmailKpi({
      now: NOW,
      emails: [
        { status: 'SENT', attempts: 1, createdAt: new Date(NOW.getTime() - HOUR) },
        { status: 'SENT', attempts: 3, createdAt: new Date(NOW.getTime() - 2 * HOUR) },
        { status: 'SENT', attempts: 4, createdAt: new Date(NOW.getTime() - 3 * HOUR) },
        { status: 'FAILED', attempts: 5, createdAt: new Date(NOW.getTime() - 4 * HOUR) },
        { status: 'PENDING', attempts: 0, createdAt: new Date(NOW.getTime() - 5 * HOUR) },
        { status: 'RETRYING', attempts: 2, createdAt: new Date(NOW.getTime() - 6 * HOUR) },
        // prior window
        { status: 'SENT', attempts: 1, createdAt: new Date(NOW.getTime() - 30 * HOUR) },
        { status: 'FAILED', attempts: 5, createdAt: new Date(NOW.getTime() - 40 * HOUR) },
      ],
    });
    expect(k.sent24h).toBe(3);
    expect(k.failed24h).toBe(1);
    expect(k.pending24h).toBe(2);
    expect(k.sentPrev24h).toBe(1);
    expect(k.failedPrev24h).toBe(1);
    // 3 sent: attempts before success = (1-1)+(3-1)+(4-1) = 0+2+3 = 5; n=3 → 5/3
    expect(k.avgAttempts).toBeCloseTo(5 / 3, 4);
  });

  it('returns 0 avg attempts when no SENT in window', () => {
    const k = aggregateEmailKpi({
      now: NOW,
      emails: [{ status: 'FAILED', attempts: 5, createdAt: new Date(NOW.getTime() - HOUR) }],
    });
    expect(k.avgAttempts).toBe(0);
  });
});

describe('statusTone & statusBadgeClasses', () => {
  it('maps known statuses to expected tones', () => {
    expect(statusTone('PAID')).toBe('ok');
    expect(statusTone('SENT')).toBe('ok');
    expect(statusTone('PENDING')).toBe('warn');
    expect(statusTone('SHIPPED')).toBe('warn');
    expect(statusTone('FAILED')).toBe('bad');
    expect(statusTone('REFUNDED')).toBe('muted');
    expect(statusTone('PARTIALLY_REFUNDED')).toBe('muted');
    expect(statusTone('UNKNOWN')).toBe('default');
  });
  it('badge classes contain the right token prefix', () => {
    expect(statusBadgeClasses('PAID')).toContain('ds-okBg');
    expect(statusBadgeClasses('PENDING')).toContain('ds-warnBg');
    expect(statusBadgeClasses('FAILED')).toContain('ds-badBg');
    expect(statusBadgeClasses('REFUNDED')).toContain('ds-surface2');
  });
});

describe('filterOrderRows', () => {
  const rows = [
    { orderNumber: 'A100', status: 'PAID',    customerEmail: 'a@x.com', createdAt: new Date('2026-04-23T00:00:00Z') },
    { orderNumber: 'A101', status: 'PENDING', customerEmail: 'b@x.com', createdAt: new Date('2026-04-23T12:00:00Z') },
    { orderNumber: 'B202', status: 'PAID',    customerEmail: 'c@x.com', createdAt: new Date('2026-04-24T00:00:00Z') },
    { orderNumber: 'B203', status: 'REFUNDED', customerEmail: null as unknown as string, createdAt: new Date('2026-04-24T11:00:00Z') },
  ];

  it('filters by status set', () => {
    const out = filterOrderRows(rows, { status: ['PAID'] });
    expect(out.map((r) => r.orderNumber)).toEqual(['A100', 'B202']);
  });
  it('filters by date range', () => {
    const out = filterOrderRows(rows, { dateFrom: new Date('2026-04-24T00:00:00Z'), dateTo: new Date('2026-04-24T23:59:59Z') });
    expect(out.map((r) => r.orderNumber)).toEqual(['B202', 'B203']);
  });
  it('searches by order number and email', () => {
    expect(filterOrderRows(rows, { search: 'a100' }).map((r) => r.orderNumber)).toEqual(['A100']);
    expect(filterOrderRows(rows, { search: 'b@x' }).map((r) => r.orderNumber)).toEqual(['A101']);
  });
});

describe('paginate', () => {
  it('clamps page to valid range', () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    expect(paginate(rows, 0, 10).page).toBe(1);
    expect(paginate(rows, 99, 10).page).toBe(3);
  });
  it('returns the right slice', () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    const r = paginate(rows, 2, 10);
    expect(r.items).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(r.totalPages).toBe(3);
  });
});

describe('pageNumbers', () => {
  it('returns full sequence when total <= 7', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('inserts ellipsis around current when total > 7', () => {
    expect(pageNumbers(5, 12)).toEqual([1, '...', 4, 5, 6, '...', 12]);
  });
});

describe('formatters', () => {
  it('prettyTemplateType maps known and falls back', () => {
    expect(prettyTemplateType('order.receipt')).toBe('Order Receipt');
    expect(prettyTemplateType('CUSTOM')).toBe('CUSTOM');
    expect(prettyTemplateType(null)).toBe('—');
  });
  it('prettyPaymentMethod maps known and falls back', () => {
    expect(prettyPaymentMethod('paypal')).toBe('PayPal');
    expect(prettyPaymentMethod('stripe')).toBe('Card');
    expect(prettyPaymentMethod('card')).toBe('Card');
    expect(prettyPaymentMethod(null)).toBe('—');
    expect(prettyPaymentMethod('crypto')).toBe('crypto');
  });
  it('formatMoney respects USD vs other currency', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney('99.99', 'EUR')).toBe('99.99 EUR');
    expect(formatMoney(null)).toBe('$0.00');
  });
});
