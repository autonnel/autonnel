import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SYNC_WINDOW_DAYS } from '@/modules/acquisition-ads/application/sync-ad-insights.service';

const h = vi.hoisted(() => ({
  runWithRequestDb: vi.fn((fn: () => unknown) => fn()),
  disposeRequestDb: vi.fn(async () => {}),
  runWithTenant: vi.fn((_tenantId: string, fn: () => unknown) => fn()),
  getCurrentTenantId: vi.fn(() => 'tenant-1'),
  acquireLock: vi.fn(async () => true),
  releaseLock: vi.fn(async () => {}),
  syncAll: vi.fn(),
  syncConnection: vi.fn(),
  makeAcquisitionAds: vi.fn(),
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
vi.mock('@/lib/adapters/cache', () => ({
  getCache: () => ({ acquireLock: h.acquireLock, releaseLock: h.releaseLock }),
}));
vi.mock('./make-acquisition-ads', () => ({ makeAcquisitionAds: h.makeAcquisitionAds }));
vi.mock('./make-ads-deps', () => ({ createAdsDepsForRequest: h.createAdsDepsForRequest }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: () => {}, warn: () => {}, error: h.logError, debug: () => {} }),
}));

const {
  acquireLock,
  releaseLock,
  syncAll,
  syncConnection,
  makeAcquisitionAds,
  createAdsDepsForRequest,
  disposeRequestDb,
  logError,
} = h;

import { beginManualAdInsightsSync } from './trigger-manual-ad-insights-sync';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  acquireLock.mockReset();
  acquireLock.mockResolvedValue(true);
  releaseLock.mockClear();
  releaseLock.mockResolvedValue(undefined);
  syncAll.mockReset();
  syncAll.mockResolvedValue({ connections: 1, ok: 1, failed: 0, skipped: 0 });
  syncConnection.mockReset();
  syncConnection.mockResolvedValue({
    connectionId: 'conn-1',
    status: 'OK',
    adsFetched: 1,
    daysUpserted: 1,
    truncated: false,
  });
  makeAcquisitionAds.mockClear();
  makeAcquisitionAds.mockImplementation(async () => ({ syncInsights: { syncAll, syncConnection } }));
  createAdsDepsForRequest.mockClear();
  createAdsDepsForRequest.mockImplementation(async () => ({}));
  disposeRequestDb.mockClear();
  logError.mockClear();
});

describe('beginManualAdInsightsSync', () => {
  it('acquires the shared ads.insights lock (the same key the hourly cron sweep uses) before anything else', async () => {
    await beginManualAdInsightsSync({ locals: {} });
    expect(acquireLock).toHaveBeenCalledWith('cron:lock:ads.insights', expect.any(Number));
  });

  it('returns false and never touches the sync services when the lock is already held', async () => {
    acquireLock.mockResolvedValue(false);
    const started = await beginManualAdInsightsSync({ locals: {}, connectionId: 'conn-1' });
    expect(started).toBe(false);
    expect(makeAcquisitionAds).not.toHaveBeenCalled();
    expect(syncAll).not.toHaveBeenCalled();
    expect(syncConnection).not.toHaveBeenCalled();
    expect(releaseLock).not.toHaveBeenCalled();
  });

  it('runs syncAll in the background for a full-tenant refresh, then releases the lock', async () => {
    const started = await beginManualAdInsightsSync({ locals: {} });
    expect(started).toBe(true);
    await flush();
    expect(syncAll).toHaveBeenCalledTimes(1);
    expect(syncConnection).not.toHaveBeenCalled();
    expect(disposeRequestDb).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith('cron:lock:ads.insights');
  });

  it('runs syncConnection with SYNC_WINDOW_DAYS for a single-connection refresh', async () => {
    await beginManualAdInsightsSync({ locals: {}, connectionId: 'conn-1' });
    await flush();
    expect(syncConnection).toHaveBeenCalledWith({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(syncAll).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledWith('cron:lock:ads.insights');
  });

  it('runs waitUntil-scoped work when locals.cfContext is present', async () => {
    const waitUntil = vi.fn();
    const started = await beginManualAdInsightsSync({ locals: { cfContext: { waitUntil } } });
    expect(started).toBe(true);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(syncAll).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledWith('cron:lock:ads.insights');
  });

  // Mirrors trigger-ad-insights-backfill.test.ts's coverage for the same production hazard: on
  // Docker/Node (`node dist/server/entry.mjs`) an unhandled rejection terminates the process, so a
  // dependency-construction failure before the sync call must still be caught, and the lock must
  // still be released so it doesn't sit locked for its full TTL.
  it('Node/production path: a dependency-construction failure never produces an unhandled rejection, and still releases the lock', async () => {
    const depsError = new Error('ads deps blew up');
    createAdsDepsForRequest.mockImplementation(async () => {
      throw depsError;
    });

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const started = await beginManualAdInsightsSync({ locals: {} });
      expect(started).toBe(true);
      await flush();
      await flush();
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(unhandled).not.toHaveBeenCalled();
    expect(syncAll).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      'manual ad insights sync failed before completing',
      expect.objectContaining({ error: depsError }),
    );
    expect(releaseLock).toHaveBeenCalledWith('cron:lock:ads.insights');
  });
});
