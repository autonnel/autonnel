import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdReconciliationTable from './AdReconciliationTable';
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

describe('AdReconciliationTable', () => {
  it('shows a specific empty state naming the currency, not a bare table', () => {
    render(<AdReconciliationTable rows={[]} currency="USD" />);
    expect(screen.getByText(/No attributed ad spend in USD/)).toBeTruthy();
  });

  it('renders funnel, platform, and account for a row', () => {
    render(<AdReconciliationTable rows={[baseRow()]} currency="USD" />);
    expect(screen.getByText('Glow Funnel')).toBeTruthy();
    expect(screen.getByText('META')).toBeTruthy();
    expect(screen.getByText('act_1')).toBeTruthy();
  });

  it('renders a not-compared note when the platform reports no checkout starts', () => {
    render(<AdReconciliationTable rows={[baseRow({ platformCheckoutInit: null, checkoutInitDiff: null })]} currency="USD" />);
    expect(screen.getAllByText('Not compared').length).toBeGreaterThan(0);
  });

  it('shows a timezone badge only when the account zone differs from the site zone', () => {
    const { rerender } = render(<AdReconciliationTable rows={[baseRow()]} currency="USD" />);
    expect(screen.queryByText(/Asia\/Shanghai/)).toBeNull();

    rerender(<AdReconciliationTable rows={[baseRow({ accountTimezone: 'Asia/Shanghai', timezoneAligned: false })]} currency="USD" />);
    // The badge names the zone AND the offset it is on: the zone id alone does not tell an
    // operator whether America/Los_Angeles is UTC-7 or UTC-8 today.
    expect(screen.getByText(/Asia\/Shanghai \(UTC\+8\)/)).toBeTruthy();
  });

  it('shows a conflict badge with a tooltip combining dynamic reasons and static notes', () => {
    render(
      <AdReconciliationTable
        rows={[baseRow({ reasons: [{ code: 'FAILED_POSTBACKS', detail: '3 conversion postback(s) failed' }] })]}
        currency="USD"
      />,
    );
    const badge = screen.getByText('1');
    const wrapper = badge.closest('span[title]');
    expect(wrapper?.getAttribute('title')).toContain('3 conversion postback(s) failed');
    expect(wrapper?.getAttribute('title')).toContain('Platform attribution windows');
  });

  it('renders "Not compared" instead of a diff when revenueDiff is null (REVENUE_CURRENCY_UNAVAILABLE)', () => {
    render(
      <AdReconciliationTable
        rows={[baseRow({ onsiteRevenueMinor: null, revenueDiff: null, reasons: [{ code: 'REVENUE_CURRENCY_UNAVAILABLE', detail: 'currency mismatch' }] })]}
        currency="USD"
      />,
    );
    expect(screen.getByText('Not compared')).toBeTruthy();
  });

  it('expands a row on click to show its creatives, and collapses again on a second click', () => {
    const row = baseRow({
      creatives: [
        {
          creativeId: 'cr-1',
          platform: 'META',
          name: 'Best ad',
          campaignName: 'Spring',
          adsetName: null,
          destinationUrl: 'https://x/y',
          spendMinor: 5000,
          impressions: 100,
          clicks: 10,
          linkClicks: null,
          conversions: 1,
          initiateCheckout: null,
        },
      ],
    });
    render(<AdReconciliationTable rows={[row]} currency="USD" />);

    expect(screen.queryByText('Best ad')).toBeNull();
    fireEvent.click(screen.getByText('Glow Funnel'));
    expect(screen.getByText('Best ad')).toBeTruthy();
    expect(screen.getByText('Spring')).toBeTruthy();

    fireEvent.click(screen.getByText('Glow Funnel'));
    expect(screen.queryByText('Best ad')).toBeNull();
  });

  it('shows an explanatory note instead of a blank area when a row has no creative detail', () => {
    render(<AdReconciliationTable rows={[baseRow({ creatives: [] })]} currency="USD" />);
    fireEvent.click(screen.getByText('Glow Funnel'));
    expect(screen.getByText(/No creative-level detail/)).toBeTruthy();
  });
});
