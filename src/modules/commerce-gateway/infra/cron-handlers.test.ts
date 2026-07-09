import { describe, it, expect, vi } from "vitest";
import { runCatalogSyncSweep } from "./cron-handlers";

describe("commerce cron handlers", () => {
  it("runCatalogSyncSweep invokes SyncCatalogService for the active tenant", async () => {
    const execute = vi.fn(async () => {});
    const makeSync = vi.fn(async () => ({ execute }));
    await runCatalogSyncSweep({ makeSyncCatalogService: makeSync as any, pageSize: 100 });
    expect(makeSync).toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith(100);
  });
});
