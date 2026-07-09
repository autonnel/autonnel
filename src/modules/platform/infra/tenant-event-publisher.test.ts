import { describe, it, expect } from "vitest";
import { TenantEventPublisher } from "./tenant-event-publisher";
import { runWithTenant } from "../../../lib/tenant/context";
import type { DomainEventEnvelope } from "../../shared-kernel/event-envelope";

describe("TenantEventPublisher", () => {
  it("enriches a partial event with the ALS tenantId, an eventId and occurredAt", async () => {
    const captured: DomainEventEnvelope[] = [];
    const outbox = {
      publish: async (e: DomainEventEnvelope) => {
        captured.push(e);
      },
      publishMany: async () => {},
    };
    const publisher = new TenantEventPublisher(outbox);

    await runWithTenant("tenant-x", async () => {
      await publisher.publish({ type: "CatalogSynced", payload: { count: 3 } });
    });

    expect(captured).toHaveLength(1);
    const env = captured[0];
    expect(env.tenantId).toBe("tenant-x");
    expect(env.type).toBe("CatalogSynced");
    expect(env.payload).toEqual({ count: 3 });
    expect(typeof env.eventId).toBe("string");
    expect(env.eventId.length).toBeGreaterThan(0);
    expect(env.occurredAt).toBeInstanceOf(Date);
  });
});
