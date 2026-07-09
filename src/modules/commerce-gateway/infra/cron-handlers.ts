import type { SyncCatalogService } from "../application/sync-catalog.service";

export interface CatalogSyncDeps {
  makeSyncCatalogService: () => Promise<Pick<SyncCatalogService, "execute">>;
  pageSize: number;
}

export async function runCatalogSyncSweep(deps: CatalogSyncDeps): Promise<void> {
  const svc = await deps.makeSyncCatalogService();
  await svc.execute(deps.pageSize);
}
