import { describe, it, expect, vi } from "vitest";
import { SyncCatalogService } from "./sync-catalog.service";
import { IngestCatalogDeltaService } from "./ingest-catalog-delta.service";
import { CatalogProductView } from "../domain/catalog-projection";
import { SyncCursor } from "../domain/value-objects/sync-cursor";
import { ExternalRef } from "../domain/value-objects/external-ref";
import type { BackendCatalogPort, CatalogProjectionStorePort } from "./ports/outbound";
import type { DomainEventPublisherPort } from "../../shared-kernel/event-envelope";

function product(ref: string): CatalogProductView {
  return CatalogProductView.create({
    backendKind: "shopify",
    externalProductRef: ExternalRef.of(ref),
    title: "P",
    status: "active",
    mediaRefs: [],
    variants: [],
  });
}

describe("SyncCatalogService", () => {
  it("crawls all pages and upserts, emitting CatalogSynced", async () => {
    const pages = [
      { products: [product("gid://p/1")], nextCursor: SyncCursor.of("c1") },
      { products: [product("gid://p/2")], nextCursor: null },
    ];
    let call = 0;
    const backend = {
      listProducts: vi.fn(async () => pages[call++]),
    } as unknown as BackendCatalogPort;
    const upsert = vi.fn(async () => {});
    const tombstoneStale = vi.fn(async (_syncedBefore: Date, _at: Date) => {});
    const store = { upsertProducts: upsert, tombstoneStaleProducts: tombstoneStale } as unknown as CatalogProjectionStorePort;
    const publish = vi.fn(async () => {});
    const events = { publish } as unknown as DomainEventPublisherPort;

    const svc = new SyncCatalogService(backend, store, events);
    const result = await svc.execute(50);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ synced: 2 });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: "CatalogSynced" }));
  });

  it("tombstones products not refreshed by the full sweep (stale provider/store leftovers)", async () => {
    const backend = {
      listProducts: vi.fn(async () => ({ products: [product("gid://p/1")], nextCursor: null })),
    } as unknown as BackendCatalogPort;
    const upsert = vi.fn(async () => {});
    const tombstoneStale = vi.fn(async (_syncedBefore: Date, _at: Date) => {});
    const store = { upsertProducts: upsert, tombstoneStaleProducts: tombstoneStale } as unknown as CatalogProjectionStorePort;
    const events = { publish: vi.fn(async () => {}) } as unknown as DomainEventPublisherPort;

    await new SyncCatalogService(backend, store, events).execute(50);

    expect(tombstoneStale).toHaveBeenCalledTimes(1);
    const [syncedBefore, at] = tombstoneStale.mock.calls[0];
    expect(syncedBefore).toBeInstanceOf(Date);
    expect((at as Date).getTime()).toBeGreaterThanOrEqual((syncedBefore as Date).getTime());
  });

  it("does not tombstone when the sweep fails partway", async () => {
    let call = 0;
    const backend = {
      listProducts: vi.fn(async () => {
        if (call++ === 0) return { products: [product("gid://p/1")], nextCursor: SyncCursor.of("c1") };
        throw new Error("backend down");
      }),
    } as unknown as BackendCatalogPort;
    const tombstoneStale = vi.fn(async (_syncedBefore: Date, _at: Date) => {});
    const store = { upsertProducts: vi.fn(async () => {}), tombstoneStaleProducts: tombstoneStale } as unknown as CatalogProjectionStorePort;
    const events = { publish: vi.fn(async () => {}) } as unknown as DomainEventPublisherPort;

    await expect(new SyncCatalogService(backend, store, events).execute(50)).rejects.toThrow("backend down");
    expect(tombstoneStale).not.toHaveBeenCalled();
  });
});

describe("IngestCatalogDeltaService", () => {
  it("refreshes changed products and tombstones deleted ones, emitting invalidation", async () => {
    const backend = {
      getProduct: vi.fn(async () => product("gid://p/1")),
    } as unknown as BackendCatalogPort;
    const upsert = vi.fn(async () => {});
    const tombstone = vi.fn(async () => {});
    const store = {
      upsertProducts: upsert,
      tombstoneProducts: tombstone,
    } as unknown as CatalogProjectionStorePort;
    const publish = vi.fn(async () => {});
    const events = { publish } as unknown as DomainEventPublisherPort;

    const svc = new IngestCatalogDeltaService(backend, store, events);
    await svc.execute({
      backendKind: "shopify",
      changedProductRefs: ["gid://p/1"],
      deletedProductRefs: ["gid://p/2"],
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(tombstone).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: "CatalogReadModelInvalidated" }));
  });
});
