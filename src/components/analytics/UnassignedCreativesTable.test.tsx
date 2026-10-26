import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ apiCall: vi.fn() }));
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiCall: h.apiCall };
});

import UnassignedCreativesTable from './UnassignedCreativesTable';
import type { UnassignedCreativeVM } from '@/lib/dashboard/ads-reconciliation-data';
import type { FunnelOption } from '@/lib/dashboard/analytics-data';

const FUNNELS: FunnelOption[] = [
  { id: 'funnel-a', name: 'Glow Funnel' },
  { id: 'funnel-b', name: 'Wellness Funnel' },
  { id: 'funnel-c', name: 'Other Funnel' },
];

function item(overrides: Partial<UnassignedCreativeVM> = {}): UnassignedCreativeVM {
  return {
    creativeId: 'cr-1',
    platform: 'META',
    name: 'Spring ad',
    destinationUrl: 'https://x/y',
    normalizedPath: '/y',
    matchState: 'UNMATCHED',
    spendMinor: 5000,
    currency: 'USD',
    candidateFunnelIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UnassignedCreativesTable', () => {
  it('renders nothing when there are no unassigned items', () => {
    const { container } = render(<UnassignedCreativesTable items={[]} funnelOptions={FUNNELS} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists every funnel as a candidate for an UNMATCHED creative', () => {
    render(<UnassignedCreativesTable items={[item({ matchState: 'UNMATCHED' })]} funnelOptions={FUNNELS} />);
    const select = screen.getByRole('combobox') as unknown as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.text);
    expect(optionLabels).toEqual(['Assign to funnel', 'Glow Funnel', 'Wellness Funnel', 'Other Funnel']);
  });

  it('lists only candidateFunnelIds for an AMBIGUOUS creative', () => {
    render(
      <UnassignedCreativesTable
        items={[item({ matchState: 'AMBIGUOUS', candidateFunnelIds: ['funnel-a', 'funnel-c'] })]}
        funnelOptions={FUNNELS}
      />,
    );
    const select = screen.getByRole('combobox') as unknown as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.text);
    expect(optionLabels).toEqual(['Assign to funnel', 'Glow Funnel', 'Other Funnel']);
  });

  it('shows a disabled placeholder when an AMBIGUOUS creative has no live candidate funnel left', () => {
    render(
      <UnassignedCreativesTable
        items={[item({ matchState: 'AMBIGUOUS', candidateFunnelIds: ['deleted-funnel'] })]}
        funnelOptions={FUNNELS}
      />,
    );
    const select = screen.getByRole('combobox') as unknown as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.options[0].text).toBe('No candidate funnel');
  });

  it('assigns the creative and removes the row from view on success', async () => {
    h.apiCall.mockResolvedValue({ ok: true });
    render(<UnassignedCreativesTable items={[item()]} funnelOptions={FUNNELS} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'funnel-a' } });

    await waitFor(() => expect(h.apiCall).toHaveBeenCalledWith(
      'POST /api/ads/creatives/:id/assign',
      { funnelId: 'funnel-a' },
      { params: { id: 'cr-1' } },
    ));
    await waitFor(() => expect(screen.queryByText('Spring ad')).toBeNull());
  });

  it('shows an inline error and keeps the row when the assign call fails', async () => {
    h.apiCall.mockRejectedValue(new Error('boom'));
    render(<UnassignedCreativesTable items={[item()]} funnelOptions={FUNNELS} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'funnel-a' } });

    await screen.findByText('Could not assign this creative.');
    expect(screen.getByText('Spring ad')).toBeTruthy();
  });
});
