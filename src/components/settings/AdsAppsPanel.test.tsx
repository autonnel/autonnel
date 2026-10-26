import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ apiCall: vi.fn(), pollSyncStatus: vi.fn() }));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiCall: h.apiCall };
});

vi.mock('@/lib/dashboard/ads-refresh-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dashboard/ads-refresh-client')>(
    '@/lib/dashboard/ads-refresh-client',
  );
  return { ...actual, pollSyncStatus: h.pollSyncStatus };
});

import AdsAppsPanel from './AdsAppsPanel';
import type { AdsAppPlatformWire } from '@/contracts/settings';

function platform(overrides: Partial<AdsAppPlatformWire> = {}): AdsAppPlatformWire {
  return {
    platform: 'META',
    label: 'Meta Ads',
    hasConfig: false,
    clientIdMasked: '',
    hasDeveloperToken: false,
    relayEnabled: true,
    connections: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.pollSyncStatus.mockResolvedValue({ running: false, lastRunAt: null, runs: [] });
});

describe('AdsAppsPanel - relay visibility', () => {
  it('renders "Use our app" when relayEnabled is true', () => {
    render(<AdsAppsPanel initial={{ platforms: [platform({ platform: 'META', relayEnabled: true })] }} />);
    expect(screen.getByText('Use our app')).toBeTruthy();
  });

  it('hides the relay button for TikTok, whose relayEnabled is false, and explains why', () => {
    render(
      <AdsAppsPanel
        initial={{ platforms: [platform({ platform: 'TIKTOK', label: 'TikTok Ads', relayEnabled: false })] }}
      />,
    );
    expect(screen.queryByText('Use our app')).toBeNull();
    expect(screen.getByText(/Hosted relay authorization is not available for TikTok/)).toBeTruthy();
  });

  it('hides the relay button for Bing and states the reporting limitation verbatim', () => {
    render(
      <AdsAppsPanel
        initial={{ platforms: [platform({ platform: 'BING_ADS', label: 'Bing Ads', relayEnabled: false })] }}
      />,
    );
    expect(screen.queryByText('Use our app')).toBeNull();
    expect(
      screen.getByText(
        'No hosted relay is available for Bing Ads. Bing Ads supports conversion postbacks only; spend and click reporting is not available.',
      ),
    ).toBeTruthy();
  });
});

describe('AdsAppsPanel - Edit then Save', () => {
  it('does not send clientId when only the secret was changed, and the stored id survives', async () => {
    const configured = platform({ platform: 'META', hasConfig: true, clientIdMasked: '••••1234' });
    h.apiCall.mockResolvedValue({
      platforms: [{ ...configured, hasConfig: true, clientIdMasked: '••••1234' }],
    });

    render(<AdsAppsPanel initial={{ platforms: [configured] }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Client Secret'), { target: { value: 'rotated-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(h.apiCall).toHaveBeenCalled());
    const [, body] = h.apiCall.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).not.toHaveProperty('clientId');
    expect(body.clientSecret).toBe('rotated-secret');

    // Back on the summary card, the client id shown is still the original one -- not blanked out.
    await waitFor(() => expect(screen.getByText('••••1234')).toBeTruthy());
  });

  it('includes clientId in the PUT body only when the user actually typed a new value', async () => {
    const configured = platform({ platform: 'META', hasConfig: true, clientIdMasked: '••••1234' });
    h.apiCall.mockResolvedValue({
      platforms: [{ ...configured, clientIdMasked: '••••9999' }],
    });

    render(<AdsAppsPanel initial={{ platforms: [configured] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'new-client-id-9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(h.apiCall).toHaveBeenCalled());
    const [, body] = h.apiCall.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.clientId).toBe('new-client-id-9999');
  });

  it('shows a truthful placeholder for the stored client id instead of a blank field', () => {
    const configured = platform({ platform: 'META', hasConfig: true, clientIdMasked: '••••1234' });
    render(<AdsAppsPanel initial={{ platforms: [configured] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = screen.getByLabelText('Client ID') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.placeholder).toContain('••••1234');
  });
});

describe('AdsAppsPanel - per-connection refresh', () => {
  const withConnection = platform({
    platform: 'META',
    hasConfig: true,
    clientIdMasked: '••••1234',
    connections: [{ id: 'conn-1', externalAccountId: 'act_1', status: 'ACTIVE', reportingTimezone: 'UTC' }],
  });

  it('disables the refresh button and shows a non-countdown message on a 429 cooldown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ retryAfterSeconds: 42, reason: 'cooldown' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdsAppsPanel initial={{ platforms: [withConnection] }} />);
    const button = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/Refresh is rate limited right now/)).toBeTruthy());
    expect(screen.queryByText(/42/)).toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(h.pollSyncStatus).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('surfaces a truncated run after a successful refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ started: true }) });
    vi.stubGlobal('fetch', fetchMock);
    h.pollSyncStatus.mockResolvedValue({
      running: false,
      lastRunAt: '2026-09-12T10:00:00.000Z',
      runs: [
        {
          connectionId: 'conn-1',
          platform: 'META',
          status: 'OK',
          startedAt: '2026-09-12T10:00:00.000Z',
          finishedAt: '2026-09-12T10:01:00.000Z',
          adsFetched: 5,
          daysUpserted: 1,
          truncated: true,
          error: null,
        },
      ],
    });

    render(<AdsAppsPanel initial={{ platforms: [withConnection] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() =>
      expect(screen.getByText(/only partially fetched this account's spend/)).toBeTruthy(),
    );

    vi.unstubAllGlobals();
  });

  it('shows the real error string after a failed refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ started: true }) });
    vi.stubGlobal('fetch', fetchMock);
    h.pollSyncStatus.mockResolvedValue({
      running: false,
      lastRunAt: '2026-09-12T10:00:00.000Z',
      runs: [
        {
          connectionId: 'conn-1',
          platform: 'META',
          status: 'FAILED',
          startedAt: '2026-09-12T10:00:00.000Z',
          finishedAt: '2026-09-12T10:00:05.000Z',
          adsFetched: 0,
          daysUpserted: 0,
          truncated: false,
          error: 'platform token expired',
        },
      ],
    });

    render(<AdsAppsPanel initial={{ platforms: [withConnection] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(screen.getByText(/platform token expired/)).toBeTruthy());

    vi.unstubAllGlobals();
  });
});
