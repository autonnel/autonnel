import type { APIRoute } from 'astro';
import { withAuthAnyOf, jsonResponse } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';

interface RunView {
  connectionId: string;
  platform: string;
  status: 'RUNNING' | 'OK' | 'FAILED';
  startedAt: string;
  finishedAt: string | null;
  adsFetched: number;
  daysUpserted: number;
  truncated: boolean;
  error: string | null;
}

// GET -> the most recent AdSyncRun row per connection, for the UI to poll after POST /api/ads/sync.
// `truncated` is surfaced as-is: a truncated run means that account's spend was only partially
// fetched, which the UI must be able to flag rather than showing a plain "done".
// Same ANALYTICS-or-SETTINGS_ADS gate as sync.ts: the per-connection refresh button on
// Settings -> Ads polls this endpoint too.
export const GET: APIRoute = withAuthAnyOf([FEATURES.ANALYTICS, FEATURES.SETTINGS_ADS], async () => {
  const db = getTenantPrisma();
  const connections: Array<{ id: string; platform: string }> = await db.adAccountConnection.findMany({
    select: { id: true, platform: true },
  });

  // One findFirst per connection rather than a single distinct/groupBy query: connection counts
  // per tenant are small (a handful of ad accounts), this keeps the query portable across the
  // relational backends this project supports, and it reads directly off the
  // [tenantId, connectionId, startedAt] index.
  const rows = await Promise.all(
    connections.map((c) =>
      db.adSyncRun.findFirst({
        where: { connectionId: c.id },
        orderBy: { startedAt: 'desc' },
      }).then((run: any) => (run ? { connection: c, run } : null)),
    ),
  );

  const runs: RunView[] = rows
    .filter((r): r is { connection: { id: string; platform: string }; run: any } => r !== null)
    .map(({ connection, run }) => ({
      connectionId: connection.id,
      platform: connection.platform,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      adsFetched: run.adsFetched,
      daysUpserted: run.daysUpserted,
      truncated: run.truncated,
      error: run.error ?? null,
    }));

  const lastRunAt = runs.reduce<string | null>(
    (max, r) => (!max || r.startedAt > max ? r.startedAt : max),
    null,
  );

  return jsonResponse({
    running: runs.some((r) => r.status === 'RUNNING'),
    lastRunAt,
    runs,
  });
});
