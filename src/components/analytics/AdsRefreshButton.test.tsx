import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  pollSyncStatus: vi.fn(),
}));

// pollSyncStatus's own timing/retry contract is covered by ads-refresh-client.test.ts; mocking it
// here isolates the component's state machine (idle -> starting -> polling/rate-limited -> idle).
vi.mock('@/lib/dashboard/ads-refresh-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dashboard/ads-refresh-client')>(
    '@/lib/dashboard/ads-refresh-client',
  );
  return { ...actual, pollSyncStatus: h.pollSyncStatus };
});

import AdsRefreshButton from './AdsRefreshButton';

const originalFetch = global.fetch;
const originalReload = window.location.reload;

function mockFetchSequence(handlers: Array<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>) {
  let i = 0;
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const handler = handlers[Math.min(i, handlers.length - 1)];
    i += 1;
    return handler(input, init);
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.pollSyncStatus.mockResolvedValue({ running: false, lastRunAt: null, runs: [] });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: originalReload } });
});

describe('AdsRefreshButton', () => {
  it('renders as type="button" so mounting it inside the range <form> cannot submit that form', async () => {
    mockFetchSequence([async () => jsonResponse({ running: false, lastRunAt: null, runs: [] })]);
    render(
      <form>
        <AdsRefreshButton />
      </form>,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/ads/sync/status'));
    const btn = screen.getByRole('button', { name: 'Refresh now' }) as HTMLButtonElement;
    expect(btn.type).toBe('button');
  });

  it('checks status on mount without triggering a sync', async () => {
    mockFetchSequence([async () => jsonResponse({ running: false, lastRunAt: null, runs: [] })]);
    render(<AdsRefreshButton />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/ads/sync/status'));
    expect((screen.getByRole('button', { name: 'Refresh now' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a truncated warning on mount when the last known run was truncated', async () => {
    mockFetchSequence([
      async () =>
        jsonResponse({
          running: false,
          lastRunAt: '2026-01-01T00:00:00.000Z',
          runs: [{ connectionId: 'c1', platform: 'META', status: 'OK', startedAt: 'x', finishedAt: 'y', adsFetched: 1, daysUpserted: 1, truncated: true, error: null }],
        }),
    ]);
    render(<AdsRefreshButton />);
    // `truncated` means the pagination cap was hit, not that a platform rate-limited the request --
    // the message must not claim rate limiting (that used to say "rate limited by a platform"), and
    // must match the wording AdsAppsPanel already uses correctly for the same condition.
    const msg = await screen.findByText(/only partially fetched/);
    expect(msg.textContent).toBe("Last refresh only partially fetched this account's spend.");
    expect(msg.textContent).not.toMatch(/rate limit/i);
  });

  it('disables the button and reloads the page once a triggered sync settles', async () => {
    mockFetchSequence([
      async () => jsonResponse({ running: false, lastRunAt: null, runs: [] }), // mount check
      async () => jsonResponse({ started: true, scope: 'all' }), // POST /api/ads/sync
    ]);
    h.pollSyncStatus.mockResolvedValue({ running: false, lastRunAt: null, runs: [] });

    render(<AdsRefreshButton />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);

    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });

  it('on a cooldown 429, disables the button and shows a message with no digit in it', async () => {
    mockFetchSequence([
      async () => jsonResponse({ running: false, lastRunAt: null, runs: [] }), // mount check
      async () => jsonResponse({ retryAfterSeconds: 42, reason: 'cooldown' }, 429), // POST
    ]);

    render(<AdsRefreshButton />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));

    const msg = await screen.findByText(/rate limited/i);
    expect(msg.textContent).not.toMatch(/\d/);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(h.pollSyncStatus).not.toHaveBeenCalled();
  });

  it('on a busy 429, polls to settlement instead of just waiting out a fixed cooldown', async () => {
    mockFetchSequence([
      async () => jsonResponse({ running: false, lastRunAt: null, runs: [] }), // mount check
      async () => jsonResponse({ retryAfterSeconds: 30, reason: 'busy' }, 429), // POST
    ]);
    h.pollSyncStatus.mockResolvedValue({ running: false, lastRunAt: null, runs: [] });

    render(<AdsRefreshButton />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));

    await waitFor(() => expect(h.pollSyncStatus).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole('button', { name: 'Refresh now' }) as HTMLButtonElement).disabled).toBe(false));
  });
});
