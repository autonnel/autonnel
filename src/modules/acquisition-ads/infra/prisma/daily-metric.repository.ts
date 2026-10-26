import { getCurrentTenantId } from '../../../../lib/tenant/context';
import type { AdDailyMetricRepositoryPort, DailyMetricUpsert } from '../../application/ports/outbound';

interface MetricDelegate {
  upsert(args: unknown): Promise<unknown>;
}

export class PrismaAdDailyMetricRepository implements AdDailyMetricRepositoryPort {
  constructor(
    private readonly delegate: MetricDelegate,
    private readonly newId: () => string,
  ) {}

  // Upsert, never insert: platforms keep backfilling the current day's numbers, so a resync of the
  // same (creative, date) must overwrite the earlier value.
  async upsertMany(rows: DailyMetricUpsert[]): Promise<number> {
    let written = 0;
    for (const row of rows) {
      const date = new Date(`${row.date}T00:00:00.000Z`);
      const data = {
        currency: row.currency,
        spendMinor: row.spendMinor,
        impressions: row.impressions,
        clicks: row.clicks,
        linkClicks: row.linkClicks,
        conversions: row.conversions,
        initiateCheckout: row.initiateCheckout,
        conversionValueMinor: row.conversionValueMinor,
        syncedAt: new Date(),
      };
      // See creative.repository.ts: the tenant extension does not inject tenantId into an
      // upsert's `where`, so the composite key needs it here explicitly and it must not also
      // appear in `create`.
      await this.delegate.upsert({
        where: {
          tenantId_creativeId_date: { tenantId: getCurrentTenantId(), creativeId: row.creativeId, date },
        },
        create: { id: this.newId(), creativeId: row.creativeId, date, ...data },
        update: data,
      });
      written += 1;
    }
    return written;
  }
}
