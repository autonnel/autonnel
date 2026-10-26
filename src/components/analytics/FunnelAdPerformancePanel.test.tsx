import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import FunnelAdPerformancePanel from './FunnelAdPerformancePanel';
import { computeDiff } from '@/lib/stats/ad-reconciliation';
import type { ReconciliationRowVM } from '@/lib/dashboard/ads-reconciliation-data';

function baseRow(overrides: Partial<ReconciliationRowVM> = {}): ReconciliationRowVM {
  return {
    funnelId: 'funnel-a',
    funnelName: 'Glow Funnel',
    platform: 'META',
    accountLabel: 'act_1',
    accountTimezone: 'UTC',
    siteTimezone: 'UTC',
    timezoneAligned: true,
    spendMinor: 100000,
    impressions: 5000,
    linkClicks: 250,
    platformCheckoutInit: 60,
    onsiteCheckouts: 55,
    checkoutInitDiff: computeDiff({ metric: 'checkoutInit', platform: 60, onsite: 55 }),
    platformConversions: 20,
    onsiteOrders: 18,
    conversionsDiff: computeDiff({ metric: 'conversions', platform: 20, onsite: 18 }),
    platformRevenueMinor: 400000,
    onsiteRevenueMinor: 390000,
    revenueDiff: computeDiff({ metric: 'revenueMinor', platform: 400000, onsite: 390000 }),
    clicksDiff: computeDiff({ metric: 'clicks', platform: 250, onsite: 280 }),
    onsiteClicks: 280,
    reasons: [],
    creatives: [],
    ...overrides,
  };
}

describe('FunnelAdPerformancePanel', () => {
  it('renders nothing at all when there are no rows for this funnel', () => {
    const { container } = render(<FunnelAdPerformancePanel rows={[]} currency="USD" unattributedHref="/analytics/ads" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders platform and account for a row, without a Funnel column', () => {
    render(<FunnelAdPerformancePanel rows={[baseRow()]} currency="USD" unattributedHref="/analytics/ads" />);
    expect(screen.getByText('META')).toBeTruthy();
    expect(screen.getByText('act_1')).toBeTruthy();
    expect(screen.queryByText('Glow Funnel')).toBeNull();
  });

  it('renders a not-compared note when the platform reports no checkout starts', () => {
    render(<FunnelAdPerformancePanel rows={[baseRow({ platformCheckoutInit: null, checkoutInitDiff: null })]} currency="USD" unattributedHref="/analytics/ads" />);
    expect(screen.getAllByText('Not compared').length).toBeGreaterThan(0);
  });

  it('renders "Not compared" instead of a diff when revenueDiff is null (REVENUE_CURRENCY_UNAVAILABLE)', () => {
    render(
      <FunnelAdPerformancePanel
        rows={[baseRow({ onsiteRevenueMinor: null, revenueDiff: null, reasons: [{ code: 'REVENUE_CURRENCY_UNAVAILABLE', detail: 'currency mismatch' }] })]}
        currency="USD"
        unattributedHref="/analytics/ads"
      />,
    );
    expect(screen.getByText('Not compared')).toBeTruthy();
  });

  it('shows a conflict badge with a tooltip combining dynamic reasons and static notes', () => {
    render(
      <FunnelAdPerformancePanel
        rows={[baseRow({ reasons: [{ code: 'FAILED_POSTBACKS', detail: '3 conversion postback(s) failed' }] })]}
        currency="USD"
        unattributedHref="/analytics/ads"
      />,
    );
    const badge = screen.getByText('1');
    const wrapper = badge.closest('span[title]');
    expect(wrapper?.getAttribute('title')).toContain('3 conversion postback(s) failed');
    expect(wrapper?.getAttribute('title')).toContain('Platform attribution windows');
  });

  it('shows a timezone badge only when the account zone differs from the site zone', () => {
    const { rerender } = render(<FunnelAdPerformancePanel rows={[baseRow()]} currency="USD" unattributedHref="/analytics/ads" />);
    expect(screen.queryByText(/Asia\/Shanghai/)).toBeNull();

    rerender(<FunnelAdPerformancePanel rows={[baseRow({ accountTimezone: 'Asia/Shanghai', timezoneAligned: false })]} currency="USD" unattributedHref="/analytics/ads" />);
    // The badge names the zone AND the offset it is on: the zone id alone does not tell an
    // operator whether America/Los_Angeles is UTC-7 or UTC-8 today.
    expect(screen.getByText(/Asia\/Shanghai \(UTC\+8\)/)).toBeTruthy();
  });

  it('states that unattributed spend is excluded and links to the global ads page', () => {
    render(<FunnelAdPerformancePanel rows={[baseRow()]} currency="USD" unattributedHref="/analytics/ads" />);
    expect(screen.getByText(/not attributed to any funnel is excluded/)).toBeTruthy();
    const link = screen.getByText('See the ads reconciliation page');
    expect(link.getAttribute('href')).toBe('/analytics/ads');
  });

  it('renders one panel per currency worth of rows, never summing across currencies', () => {
    render(<FunnelAdPerformancePanel rows={[baseRow({ spendMinor: 50000 })]} currency="EUR" unattributedHref="/analytics/ads" />);
    expect(screen.getByText(/Ad performance/)).toBeTruthy();
    expect(screen.getByText(/EUR/)).toBeTruthy();
  });
});
