import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BACKFILL_DAYS } from '@/modules/acquisition-ads/application/sync-ad-insights.service';

const h = vi.hoisted(() => ({
  runWithRequestDb: vi.fn((fn: () => unknown) => fn()),
  disposeRequestDb: vi.fn(async () => {}),
  runWithTenant: vi.fn((_tenantId: string, fn: () => unknown) => fn()),
  getCurrentTenantId: vi.fn(() => 'tenant-1'),
  syncConnection: vi.fn(),
  makeAcquisitionAds: vi.fn(async () => ({ syncInsights: { syncConnection: h.syncConnection } })),
  createAdsDepsForRequest: vi.fn(async () => ({})),
  logError: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  runWithRequestDb: h.runWithRequestDb,
  disposeRequestDb: h.disposeRequestDb,
}));
vi.mock('@/lib/tenant/context', () => ({
  runWithTenant: h.runWithTenant,
  getCurrentTenantId: h.getCurrentTenantId,
}));
vi.mock('./make-acquisition-ads', () => ({ makeAcquisitionAds: h.makeAcquisitionAds }));
vi.mock('./make-ads-deps', () => ({ createAdsDepsForRequest: h.createAdsDepsForRequest }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: () => {}, warn: () => {}, error: h.logError, debug: () => {} }),
}));

const { syncConnection, makeAcquisitionAds, createAdsDepsForRequest, runWithTenant, disposeRequestDb, logError } = h;

import { triggerFirstConnectBackfill } from './trigger-ad-insights-backfill';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  syncConnection.mockReset();
  syncConnection.mockResolvedValue({ connectionId: 'conn-ok', status: 'OK', adsFetched: 1, daysUpserted: 1, truncated: false });
  makeAcquisitionAds.mockClear();
  makeAcquisitionAds.mockImplementation(async () => ({ syncInsights: { syncConnection } }));
  createAdsDepsForRequest.mockClear();
  createAdsDepsForRequest.mockImplementation(async () => ({}));
  runWithTenant.mockClear();
  disposeRequestDb.mockClear();
  logError.mockClear();
});

describe('triggerFirstConnectBackfill', () => {
  it('does nothing when there are no connection ids', () => {
    triggerFirstConnectBackfill({}, 'META', []);
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
  });

  it('runs waitUntil-scoped work when locals.cfContext is present', async () => {
    const waitUntil = vi.fn();
    triggerFirstConnectBackfill({ cfContext: { waitUntil } }, 'META', ['conn-1']);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(syncConnection).toHaveBeenCalledWith({ connectionId: 'conn-1', windowDays: BACKFILL_DAYS });
  });

  it('fires and forgets in Node (no cfContext) and still runs the sync', async () => {
    triggerFirstConnectBackfill({}, 'META', ['conn-1']);
    await flush();
    expect(syncConnection).toHaveBeenCalledWith({ connectionId: 'conn-1', windowDays: BACKFILL_DAYS });
    expect(disposeRequestDb).toHaveBeenCalled();
  });

  it('iterates every discovered connection id, in the tenant carried at trigger time', async () => {
    triggerFirstConnectBackfill({}, 'META', ['conn-1', 'conn-2', 'conn-3']);
    await flush();
    expect(syncConnection).toHaveBeenCalledTimes(3);
    expect(syncConnection).toHaveBeenNthCalledWith(1, { connectionId: 'conn-1', windowDays: BACKFILL_DAYS });
    expect(syncConnection).toHaveBeenNthCalledWith(2, { connectionId: 'conn-2', windowDays: BACKFILL_DAYS });
    expect(syncConnection).toHaveBeenNthCalledWith(3, { connectionId: 'conn-3', windowDays: BACKFILL_DAYS });
    expect(runWithTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
  });

  it('continues past a connection that resolves with a FAILED status', async () => {
    syncConnection.mockImplementation(async ({ connectionId }: { connectionId: string }) => {
      if (connectionId === 'conn-bad') {
        return { connectionId, status: 'FAILED', adsFetched: 0, daysUpserted: 0, truncated: false, error: 'boom' };
      }
      return { connectionId, status: 'OK', adsFetched: 1, daysUpserted: 1, truncated: false };
    });

    triggerFirstConnectBackfill({}, 'META', ['conn-good-1', 'conn-bad', 'conn-good-2']);
    await flush();

    expect(syncConnection).toHaveBeenCalledTimes(3);
    expect(syncConnection).toHaveBeenNthCalledWith(3, { connectionId: 'conn-good-2', windowDays: BACKFILL_DAYS });
  });

  it('continues past a connection whose sync call rejects outright', async () => {
    syncConnection.mockImplementation(async ({ connectionId }: { connectionId: string }) => {
      if (connectionId === 'conn-throws') throw new Error('unexpected rejection');
      return { connectionId, status: 'OK', adsFetched: 1, daysUpserted: 1, truncated: false };
    });

    triggerFirstConnectBackfill({}, 'META', ['conn-throws', 'conn-after']);
    await flush();

    expect(syncConnection).toHaveBeenCalledTimes(2);
    expect(syncConnection).toHaveBeenNthCalledWith(2, { connectionId: 'conn-after', windowDays: BACKFILL_DAYS });
  });

  // Coverage for the fix in review round 1: a failure constructing ads deps (before the
  // per-connection loop even starts) used to reject `task` with nothing attached to it on the
  // Node/Docker branch (`void task`), which is this project's PRODUCTION runtime
  // (`node dist/server/entry.mjs`), not a dev-only fallback. Node has terminated the process on
  // an unhandled rejection by default since v15, so this is asserted two ways: directly, via a
  // real `process.on('unhandledRejection', ...)` listener (Vitest runs in Node, so this observes
  // the actual runtime event, not a proxy for it); and indirectly, by confirming the failure was
  // logged with the platform and the full connectionIds list instead of being swallowed silently.
  it('Node/production path: a dependency-construction failure never produces an unhandled rejection', async () => {
    const depsError = new Error('ads deps blew up');
    createAdsDepsForRequest.mockImplementation(async () => {
      throw depsError;
    });

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      expect(() => triggerFirstConnectBackfill({}, 'META', ['conn-1', 'conn-2'])).not.toThrow();
      // unhandledRejection fires once Node's microtask queue is fully drained without a handler
      // attached; two macrotask flushes give both the rejection and Node's own detection a turn.
      await flush();
      await flush();
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(unhandled).not.toHaveBeenCalled();
    expect(syncConnection).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('first-connect backfill failed before syncing any connection', {
      platform: 'META',
      connectionIds: ['conn-1', 'conn-2'],
      error: depsError,
    });
  });
});
