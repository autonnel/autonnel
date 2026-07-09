import type { BackendCatalogPort, CatalogProjectionStorePort } from "./ports/outbound";
import { SyncCursor } from "../domain/value-objects/sync-cursor";
import type { DomainEventPublisherPort } from "../../shared-kernel/event-envelope";

export class SyncCatalogService {
  constructor(
    private readonly backend: BackendCatalogPort,
    private readonly store: CatalogProjectionStorePort,
    private readonly events: DomainEventPublisherPort,
  ) {}

  async execute(pageSize: number): Promise<{ synced: number }> {
    const startedAt = new Date();
    let cursor: SyncCursor | null = SyncCursor.start();
    let total = 0;
    while (cursor) {
      const page = await this.backend.listProducts(cursor, pageSize);
      await this.store.upsertProducts(page.products);
      total += page.products.length;
      cursor = page.nextCursor;
    }
    // Full sweep completed without error: anything not refreshed this run is gone from the backend
    // (deleted upstream, or left behind by a previous provider/store). Hide it so the projection
    // reflects only the currently-connected backend. Skipped on partial sweeps since execute throws.
    await this.store.tombstoneStaleProducts(startedAt, new Date());
    await this.events.publish({ type: "CatalogSynced", payload: { count: total } });
    return { synced: total };
  }
}
