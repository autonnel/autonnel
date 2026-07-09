import { describe, it, expect, vi } from "vitest";
import { SubmitHandoffService } from "./submit-handoff.service";
import { HandoffTranslator } from "../domain/services/handoff-translator";
import { CapabilityProfile } from "../domain/value-objects/capability-profile";
import { ExternalRef } from "../domain/value-objects/external-ref";
import type { BackendOrderPort, BackendCatalogPort } from "./ports/outbound";
import type { DomainEventPublisherPort } from "../../shared-kernel/event-envelope";
import type { SubmitHandoffCommand } from "./ports/inbound";

const profile = CapabilityProfile.of({
  supportsPresentmentPricing: true,
  supportsRealtimeInventory: true,
  supportsExternalPaidOrder: true,
  supportsWebhooks: true,
  handoffStrategy: "orderCreate",
});

const command: SubmitHandoffCommand = {
  saleRef: "sale-1",
  capturedTotalMinor: 2000,
  currencyCode: "USD",
  lines: [{ variantRef: "gid://v/1", quantity: 2, unitPriceMinor: 1000, currencyCode: "USD" }],
  customer: { email: "a@b.co" },
};

function deps() {
  const order: BackendOrderPort = {
    createPaidOrder: vi.fn(async () => ({ backendOrderRef: ExternalRef.of("gid://order/9") })),
  };
  const catalog = { describeCapabilities: () => profile } as unknown as BackendCatalogPort;
  const publish = vi.fn(async () => {});
  const events = { publish } as unknown as DomainEventPublisherPort;
  return { order, catalog, events, publish };
}

describe("SubmitHandoffService", () => {
  it("creates an already-paid backend order with the saleId-derived idempotency key", async () => {
    const d = deps();
    const svc = new SubmitHandoffService(d.order, d.catalog, new HandoffTranslator(), d.events as any, () => "tenant-1");
    const result = await svc.execute(command);
    expect(result.status).toBe("succeeded");
    expect(result.backendOrderRef).toBe("gid://order/9");
    expect(d.order.createPaidOrder).toHaveBeenCalledWith(
      expect.objectContaining({ alreadyPaid: true, financialStatus: "paid" }),
      expect.stringContaining("tenant-1"),
    );
    expect(d.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "HandoffSucceeded" }));
  });

  it("publishes HandoffFailed and returns failed when the backend create throws", async () => {
    const d = deps();
    (d.order.createPaidOrder as any).mockRejectedValueOnce(new Error("boom"));
    const svc = new SubmitHandoffService(d.order, d.catalog, new HandoffTranslator(), d.events as any, () => "tenant-1");
    const result = await svc.execute(command);
    expect(result.status).toBe("failed");
    expect(d.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "HandoffFailed" }));
  });
});
