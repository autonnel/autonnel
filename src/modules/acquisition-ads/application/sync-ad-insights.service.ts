import { buildPageIndex, matchPath } from '../domain/services/url-attribution';
import type {
  AdCreativeRepositoryPort,
  AdDailyMetricRepositoryPort,
  AdInsightRow,
  AdInsightsPort,
  AdSyncRunRepositoryPort,
  CreativeUpsert,
  DailyMetricUpsert,
} from './ports/outbound';

// Platforms keep revising the current day's numbers for a while, so every run re-pulls the last
// three account-local days and upserts over what is already stored.
export const SYNC_WINDOW_DAYS = 3;
export const BACKFILL_DAYS = 30;
export const ACCOUNT_CONCURRENCY = 3;

export interface SyncableConnection {
  id: string;
  platform: string;
  externalAccountId: string;
  reportingTimezone: string | null;
}

interface LoggerLike {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface SyncDeps {
  creativeRepo: AdCreativeRepositoryPort;
  metricRepo: AdDailyMetricRepositoryPort;
  syncRunRepo: AdSyncRunRepositoryPort;
  insightsFor(platform: string): AdInsightsPort | null;
  listConnections(): Promise<SyncableConnection[]>;
  accessTokenFor(connectionId: string): Promise<{ accessToken: string; developerToken?: string; loginCustomerId?: string }>;
  loadPages(): Promise<Array<{ id: string; slug: string }>>;
  loadFunnels(): Promise<Array<{ id: string; steps: unknown }>>;
  saveAccountTimezone(connectionId: string, timezone: string): Promise<void>;
  // Stamps AdAccountConnection.lastInsightsSyncAt so the UI can say how fresh a number is.
  markSynced(connectionId: string, at: Date): Promise<void>;
  // YYYY-MM-DD "today" in the given IANA zone.
  today(timezone: string | null): string;
  logger: LoggerLike;
}

export interface ConnectionSyncResult {
  connectionId: string;
  status: 'OK' | 'FAILED' | 'SKIPPED';
  adsFetched: number;
  daysUpserted: number;
  truncated: boolean;
  error?: string;
}

export interface SyncSummary {
  connections: number;
  ok: number;
  failed: number;
  skipped: number;
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  return new Date(base + deltaDays * 86_400_000).toISOString().slice(0, 10);
}

export class SyncAdInsightsService {
  constructor(private readonly deps: SyncDeps) {}

  async syncAll(input: { windowDays?: number } = {}): Promise<SyncSummary> {
    const windowDays = input.windowDays ?? SYNC_WINDOW_DAYS;

    let connections: SyncableConnection[];
    try {
      connections = await this.deps.listConnections();
    } catch (err) {
      // Nothing to isolate per-account here: we could not even enumerate the accounts. Report an
      // empty sweep instead of letting this reject out of whatever cron/job runner called us.
      this.deps.logger.error('ads.insights sweep failed to list connections', { error: err });
      return { connections: 0, ok: 0, failed: 0, skipped: 0 };
    }

    const summary: SyncSummary = { connections: connections.length, ok: 0, failed: 0, skipped: 0 };

    for (let i = 0; i < connections.length; i += ACCOUNT_CONCURRENCY) {
      const slice = connections.slice(i, i + ACCOUNT_CONCURRENCY);
      // allSettled, not all: syncResolved already carries its own error boundary, but this is a
      // second, independent guard so a future edit to that boundary cannot take the whole sweep
      // down with one rejecting account.
      const settled = await Promise.allSettled(slice.map((c) => this.syncResolved(c, windowDays)));
      for (let idx = 0; idx < settled.length; idx += 1) {
        const outcome = settled[idx];
        const result: ConnectionSyncResult =
          outcome.status === 'fulfilled'
            ? outcome.value
            : this.toEscapedFailure(slice[idx], outcome.reason);
        if (result.status === 'OK') summary.ok += 1;
        else if (result.status === 'FAILED') summary.failed += 1;
        else summary.skipped += 1;
      }
    }

    this.deps.logger.info('ads.insights sweep complete', { ...summary });
    return summary;
  }

  async syncConnection(input: { connectionId: string; windowDays: number }): Promise<ConnectionSyncResult> {
    let connections: SyncableConnection[];
    try {
      connections = await this.deps.listConnections();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.deps.logger.error('ads.insights failed to resolve connection for sync', {
        connectionId: input.connectionId,
        error: err,
      });
      return { connectionId: input.connectionId, status: 'FAILED', adsFetched: 0, daysUpserted: 0, truncated: false, error: message };
    }

    const connection = connections.find((c) => c.id === input.connectionId);
    if (!connection) {
      return { connectionId: input.connectionId, status: 'SKIPPED', adsFetched: 0, daysUpserted: 0, truncated: false };
    }

    return this.syncResolved(connection, input.windowDays);
  }

  // Everything that can reject for a single already-resolved account lives inside this one
  // boundary, including the run-row creation, so one account's transient failure (e.g. the DB
  // rejecting syncRunRepo.start) turns into a FAILED result instead of an unhandled rejection
  // that would abort the whole batch in syncAll's Promise.allSettled.
  private async syncResolved(connection: SyncableConnection, windowDays: number): Promise<ConnectionSyncResult> {
    const port = this.deps.insightsFor(connection.platform);
    if (!port) {
      // Bing has OAuth and conversions but no insights adapter; skipping is expected, not an error,
      // and no run row is written since AdSyncRunRepositoryPort has no SKIPPED status to record.
      return { connectionId: connection.id, status: 'SKIPPED', adsFetched: 0, daysUpserted: 0, truncated: false };
    }

    let runId: string | null = null;
    try {
      const end = this.deps.today(connection.reportingTimezone);
      const start = shiftDate(end, -(windowDays - 1));
      runId = await this.deps.syncRunRepo.start({
        connectionId: connection.id,
        windowStart: start,
        windowEnd: end,
      });

      const creds = await this.deps.accessTokenFor(connection.id);

      if (!connection.reportingTimezone) {
        const tz = await port.fetchAccountTimezone({
          accessToken: creds.accessToken,
          externalAccountId: connection.externalAccountId,
          developerToken: creds.developerToken,
        });
        if (tz) await this.deps.saveAccountTimezone(connection.id, tz);
      }

      const { rows, truncated: fetchTruncated } = await port.fetchAdInsights({
        accessToken: creds.accessToken,
        externalAccountId: connection.externalAccountId,
        start,
        end,
        developerToken: creds.developerToken,
        loginCustomerId: creds.loginCustomerId,
      });
      // Mutable: the creativeId-drop guard below can also mark this account's numbers
      // undercounted, on top of whatever the fetch itself already reported.
      let truncated = fetchTruncated;

      if (truncated) {
        this.deps.logger.warn('ads.insights hit the page cap; this account is undercounted', {
          connectionId: connection.id,
          platform: connection.platform,
        });
      }

      const [pages, funnels] = await Promise.all([this.deps.loadPages(), this.deps.loadFunnels()]);
      const index = buildPageIndex(pages, funnels);

      const creatives = this.toCreativeUpserts(rows, index);
      const idByExternalId = await this.deps.creativeRepo.upsertMany(
        connection.id,
        connection.platform,
        creatives,
      );

      const metrics: DailyMetricUpsert[] = [];
      let droppedMetrics = 0;
      for (const r of rows) {
        const creativeId = idByExternalId.get(r.externalAdId);
        if (!creativeId) {
          droppedMetrics += 1;
          continue;
        }
        metrics.push({
          creativeId,
          date: r.date,
          currency: r.currency,
          spendMinor: r.spendMinor,
          impressions: r.impressions,
          clicks: r.clicks,
          linkClicks: r.linkClicks,
          conversions: r.conversions,
          initiateCheckout: r.initiateCheckout,
          conversionValueMinor: r.conversionValueMinor,
        });
      }
      if (droppedMetrics > 0) {
        // No persisted creative row for this externalAdId means its metric rows have nowhere to
        // attach and are silently unpersisted otherwise -- as loud as the page-cap truncation above.
        truncated = true;
        this.deps.logger.warn('ads.insights dropped metric rows with no matching persisted creative', {
          connectionId: connection.id,
          platform: connection.platform,
          droppedMetrics,
        });
      }
      const daysUpserted = await this.deps.metricRepo.upsertMany(metrics);

      await this.deps.markSynced(connection.id, new Date());

      await this.deps.syncRunRepo.finish({
        runId,
        status: 'OK',
        adsFetched: creatives.length,
        daysUpserted,
        truncated,
      });

      return {
        connectionId: connection.id,
        status: 'OK',
        adsFetched: creatives.length,
        daysUpserted,
        truncated,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.deps.logger.error('ads.insights sync failed for one account', {
        connectionId: connection.id,
        platform: connection.platform,
        error: err,
      });
      // runId is null when syncRunRepo.start itself is what rejected; there is no row to close.
      if (runId) {
        try {
          await this.deps.syncRunRepo.finish({
            runId,
            status: 'FAILED',
            adsFetched: 0,
            daysUpserted: 0,
            truncated: false,
            error: message,
          });
        } catch (finishErr) {
          this.deps.logger.error('ads.insights failed to record the FAILED run', {
            connectionId: connection.id,
            error: finishErr,
          });
        }
      }
      return {
        connectionId: connection.id,
        status: 'FAILED',
        adsFetched: 0,
        daysUpserted: 0,
        truncated: false,
        error: message,
      };
    }
  }

  private toEscapedFailure(connection: SyncableConnection, reason: unknown): ConnectionSyncResult {
    const message = reason instanceof Error ? reason.message : String(reason);
    this.deps.logger.error('ads.insights sync rejected past its own error boundary', {
      connectionId: connection.id,
      platform: connection.platform,
      error: reason,
    });
    return { connectionId: connection.id, status: 'FAILED', adsFetched: 0, daysUpserted: 0, truncated: false, error: message };
  }

  private toCreativeUpserts(rows: AdInsightRow[], index: ReturnType<typeof buildPageIndex>): CreativeUpsert[] {
    const byAdId = new Map<string, CreativeUpsert>();
    const now = new Date();
    for (const r of rows) {
      if (byAdId.has(r.externalAdId)) continue;
      const m = matchPath(r.destinationUrl, index);
      byAdId.set(r.externalAdId, {
        externalAdId: r.externalAdId,
        name: r.name,
        status: r.status,
        campaignExternalId: r.campaignExternalId,
        campaignName: r.campaignName,
        adsetExternalId: r.adsetExternalId,
        adsetName: r.adsetName,
        destinationUrl: r.destinationUrl,
        normalizedPath: m.normalizedPath,
        autoFunnelId: m.funnelId,
        matchState: m.state,
        lastSeenAt: now,
      });
    }
    return [...byAdId.values()];
  }
}
