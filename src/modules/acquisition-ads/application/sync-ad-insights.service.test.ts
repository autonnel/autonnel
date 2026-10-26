import { describe, it, expect, vi } from 'vitest';
import { SyncAdInsightsService, SYNC_WINDOW_DAYS, ACCOUNT_CONCURRENCY } from './sync-ad-insights.service';
import type { SyncableConnection } from './sync-ad-insights.service';

function insightRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    externalAdId: 'ad-1',
    name: 'Ad',
    status: 'ACTIVE',
    campaignExternalId: null,
    campaignName: null,
    adsetExternalId: null,
    adsetName: null,
    destinationUrl: 'https://any.example/lp-glow',
    date: '2026-09-11',
    currency: 'USD',
    spendMinor: 1000,
    impressions: 10,
    clicks: 5,
    linkClicks: 4,
    conversions: 1,
    conversionValueMinor: 5000,
    ...over,
  };
}

function deps(over: Partial<any> = {}) {
  const creativeRepo = {
    // Params typed here (rather than left inferred) so mock.calls[0] is a 3-tuple below,
    // matching the real AdCreativeRepositoryPort#upsertMany signature.
    upsertMany: vi.fn(async (_connectionId: string, _platform: string, _rows: unknown[]) => new Map([['ad-1', 'creative-1']])),
    listByConnection: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    setManualFunnel: vi.fn(async () => {}),
  };
  const metricRepo = { upsertMany: vi.fn(async (rows: unknown[]) => rows.length) };
  const syncRunRepo = { start: vi.fn(async () => 'run-1'), finish: vi.fn(async () => {}) };
  const insights = {
    platform: 'META',
    fetchAdInsights: vi.fn(async () => ({ rows: [insightRow()], truncated: false })),
    fetchAccountTimezone: vi.fn(async () => 'America/Los_Angeles'),
  };
  return {
    creativeRepo,
    metricRepo,
    syncRunRepo,
    // Widened to `typeof insights | null` / SyncableConnection[] so a test can reassign these
    // mocks with a different literal (e.g. reportingTimezone: null, or a null insights port)
    // without a structural type mismatch against this default.
    insightsFor: vi.fn((_platform: string): typeof insights | null => insights),
    insights,
    listConnections: vi.fn(async (): Promise<SyncableConnection[]> => [
      { id: 'conn-1', platform: 'META', externalAccountId: 'act_1', reportingTimezone: 'America/Los_Angeles' },
    ]),
    accessTokenFor: vi.fn(async () => ({ accessToken: 'tok' })),
    loadPages: vi.fn(async () => [{ id: 'page-lp', slug: 'lp-glow' }]),
    loadFunnels: vi.fn(async () => [{ id: 'funnel-a', steps: [{ pageId: 'page-lp' }] }]),
    saveAccountTimezone: vi.fn(async () => {}),
    markSynced: vi.fn(async () => {}),
    today: () => '2026-09-12',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ...over,
  };
}

describe('SyncAdInsightsService.syncConnection', () => {
  it('requests the account-local window of today plus the two previous days', async () => {
    const d = deps();
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(d.insights.fetchAdInsights).toHaveBeenCalledWith(
      expect.objectContaining({ start: '2026-09-10', end: '2026-09-12' }),
    );
  });

  it('attributes the creative to the funnel owning the matched path', async () => {
    const d = deps();
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    const [, , rows] = d.creativeRepo.upsertMany.mock.calls[0];
    expect(rows[0]).toMatchObject({ normalizedPath: '/lp-glow', autoFunnelId: 'funnel-a', matchState: 'MATCHED' });
  });

  it('writes one metric row per ad per day using the creative id returned by the upsert', async () => {
    const d = deps();
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(d.metricRepo.upsertMany).toHaveBeenCalledWith([
      expect.objectContaining({ creativeId: 'creative-1', date: '2026-09-11', spendMinor: 1000, linkClicks: 4 }),
    ]);
  });

  it('collapses duplicate ad rows across days into one creative upsert', async () => {
    const d = deps();
    d.insights.fetchAdInsights = vi.fn(async () => ({
      rows: [insightRow({ date: '2026-09-10' }), insightRow({ date: '2026-09-11' })],
      truncated: false,
    }));
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    const [, , rows] = d.creativeRepo.upsertMany.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(d.metricRepo.upsertMany.mock.calls[0][0]).toHaveLength(2);
  });

  it('stamps lastInsightsSyncAt so the page can show data freshness', async () => {
    const d = deps();
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(d.markSynced).toHaveBeenCalledWith('conn-1', expect.any(Date));
  });

  it('records the run as OK with the counts', async () => {
    const d = deps();
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(d.syncRunRepo.finish).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', status: 'OK', adsFetched: 1, daysUpserted: 1, truncated: false }),
    );
  });

  it('records truncation and warns instead of swallowing it', async () => {
    const d = deps();
    d.insights.fetchAdInsights = vi.fn(async () => ({ rows: [insightRow()], truncated: true }));
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(d.syncRunRepo.finish).toHaveBeenCalledWith(expect.objectContaining({ truncated: true }));
    expect(d.logger.warn).toHaveBeenCalled();
  });

  it('marks the run truncated and warns when a fetched row has no matching persisted creative', async () => {
    const d = deps();
    // The insights fetch returns two ads, but the creative-repo mock (unlike the real repo) only
    // ever returns an id for 'ad-1' -- 'ad-2' is the row this guard must catch, since silently
    // continuing past it drops that ad's metrics with nothing recorded anywhere.
    d.insights.fetchAdInsights = vi.fn(async () => ({
      rows: [insightRow(), insightRow({ externalAdId: 'ad-2' })],
      truncated: false,
    }));
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(d.metricRepo.upsertMany).toHaveBeenCalledWith([expect.objectContaining({ creativeId: 'creative-1' })]);
    expect(d.syncRunRepo.finish).toHaveBeenCalledWith(expect.objectContaining({ status: 'OK', truncated: true }));
    expect(d.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dropped metric rows'),
      expect.objectContaining({ droppedMetrics: 1 }),
    );
  });

  it('stores the reporting timezone when the connection has none yet', async () => {
    const d = deps();
    d.listConnections = vi.fn(async () => [
      { id: 'conn-1', platform: 'META', externalAccountId: 'act_1', reportingTimezone: null },
    ]);
    await new SyncAdInsightsService(d as never).syncConnection({ connectionId: 'conn-1', windowDays: SYNC_WINDOW_DAYS });
    expect(d.saveAccountTimezone).toHaveBeenCalledWith('conn-1', 'America/Los_Angeles');
  });
});

describe('SyncAdInsightsService.syncAll', () => {
  it('isolates a failing account so the others still sync', async () => {
    const d = deps();
    d.listConnections = vi.fn(async () => [
      { id: 'bad', platform: 'META', externalAccountId: 'a', reportingTimezone: 'UTC' },
      { id: 'good', platform: 'META', externalAccountId: 'b', reportingTimezone: 'UTC' },
    ]);
    d.insights.fetchAdInsights = vi.fn(async (input: any) =>
      input.externalAccountId === 'a' ? Promise.reject(new Error('boom')) : { rows: [insightRow()], truncated: false },
    );

    const summary = await new SyncAdInsightsService(d as never).syncAll();

    expect(summary).toMatchObject({ connections: 2, ok: 1, failed: 1 });
    expect(d.syncRunRepo.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', error: expect.stringContaining('boom') }),
    );
  });

  it('skips platforms with no insights adapter rather than throwing', async () => {
    const d = deps();
    d.listConnections = vi.fn(async () => [
      { id: 'bing', platform: 'BING_ADS', externalAccountId: 'b', reportingTimezone: 'UTC' },
    ]);
    d.insightsFor = vi.fn(() => null);
    const summary = await new SyncAdInsightsService(d as never).syncAll();
    expect(summary).toMatchObject({ connections: 1, ok: 0, failed: 0, skipped: 1 });
  });

  it('lets other accounts in the same batch sync when syncRunRepo.start rejects for one', async () => {
    const d = deps();
    d.listConnections = vi.fn(async (): Promise<SyncableConnection[]> => [
      { id: 'bad', platform: 'META', externalAccountId: 'a', reportingTimezone: 'UTC' },
      { id: 'good', platform: 'META', externalAccountId: 'b', reportingTimezone: 'UTC' },
    ]);
    d.syncRunRepo.start = vi.fn(async (input: { connectionId: string }) =>
      input.connectionId === 'bad' ? Promise.reject(new Error('db unavailable')) : 'run-good',
    );

    const summary = await new SyncAdInsightsService(d as never).syncAll();

    expect(summary).toMatchObject({ connections: 2, ok: 1, failed: 1 });
    expect(d.syncRunRepo.finish).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-good', status: 'OK' }));
    // No run row exists for 'bad' since start() itself is what rejected, so finish() is called
    // exactly once, for 'good' only.
    expect(d.syncRunRepo.finish).toHaveBeenCalledTimes(1);
  });

  it('does not throw when listConnections rejects; reports an empty sweep and logs the error', async () => {
    const d = deps();
    d.listConnections = vi.fn(async () => {
      throw new Error('network down');
    });

    const summary = await new SyncAdInsightsService(d as never).syncAll();

    expect(summary).toEqual({ connections: 0, ok: 0, failed: 0, skipped: 0 });
    expect(d.logger.error).toHaveBeenCalled();
  });

  it('keeps later batches running after an earlier batch has a rejection', async () => {
    const d = deps();
    const connections: SyncableConnection[] = Array.from({ length: ACCOUNT_CONCURRENCY + 1 }, (_, i) => ({
      id: `c${i + 1}`,
      platform: 'META',
      externalAccountId: `a${i + 1}`,
      reportingTimezone: 'UTC',
    }));
    d.listConnections = vi.fn(async (): Promise<SyncableConnection[]> => connections);
    // c1 is in the first batch (indexes 0..ACCOUNT_CONCURRENCY-1) and fails; c(ACCOUNT_CONCURRENCY+1)
    // only runs in the second batch, so it proves the sweep did not stop after the first rejection.
    d.insights.fetchAdInsights = vi.fn(async (input: { externalAccountId: string }) =>
      input.externalAccountId === 'a1'
        ? Promise.reject(new Error('boom'))
        : { rows: [insightRow()], truncated: false },
    );

    const summary = await new SyncAdInsightsService(d as never).syncAll();

    expect(summary).toMatchObject({ connections: ACCOUNT_CONCURRENCY + 1, ok: ACCOUNT_CONCURRENCY, failed: 1 });
    const lastConnectionId = `c${ACCOUNT_CONCURRENCY + 1}`;
    expect(d.markSynced.mock.calls.map((c: unknown[]) => c[0])).toContain(lastConnectionId);
  });
});
