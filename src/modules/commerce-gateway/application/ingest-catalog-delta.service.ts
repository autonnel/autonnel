import type { BackendCatalogPort, CatalogProjectionStorePort } from "./ports/outbound";
import type { CatalogDelta } from "./ports/inbound";
import { ExternalRef } from "../domain/value-objects/external-ref";
import { CatalogProductView } from "../domain/catalog-projection";
import type { DomainEventPublisherPort } from "../../shared-kernel/event-envelope";

export class IngestCatalogDeltaService {
  constructor(
    private readonly backend: BackendCatalogPort,
    private readonly store: CatalogProjectionStorePort,
    private readonly events: DomainEventPublisherPort,
  ) {}

  async execute(delta: CatalogDelta): Promise<void> {
    const refreshed: CatalogProductView[] = [];
    for (const ref of delta.changedProductRefs) {
      const product = await this.backend.getProduct(ExternalRef.of(ref));
      if (product) refreshed.push(product);
    }
    if (refreshed.length > 0) await this.store.upsertProducts(refreshed);

    if (delta.deletedProductRefs.length > 0) {
      await this.store.tombstoneProducts(
        delta.deletedProductRefs.map((r) => ExternalRef.of(r)),
        new Date(),
      );
    }

    await this.events.publish({
      type: "CatalogReadModelInvalidated",
      payload: {
        changed: delta.changedProductRefs,
        deleted: delta.deletedProductRefs,
      },
    });
  }
}
