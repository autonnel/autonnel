import { describe, it, expect, vi } from "vitest";
import { deliverEnvelope, EventDeliveryError, type EventHandler } from "./event-delivery-core";
import type { DomainEventEnvelope } from "../modules/shared-kernel/event-envelope";

const envelope: DomainEventEnvelope = {
  eventId: "e1", type: "payment.captured", tenantId: "t1",
  occurredAt: new Date(0), payload: {}, correlation: { saleRef: "s1" },
};

describe("deliverEnvelope", () => {
  it("runs every handler then fans out notifications on full success", async () => {
    const order = vi.fn<EventHandler>(async () => {});
    const conversion = vi.fn<EventHandler>(async () => {});
    const notify = vi.fn(async () => {});

    await deliverEnvelope(envelope, [order, conversion], notify);

    expect(order).toHaveBeenCalledTimes(1);
    expect(conversion).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("still runs later handlers when an earlier one throws, then throws so the outbox keeps the row", async () => {
    const failing = vi.fn<EventHandler>(async () => {
      throw new Error("order creation blew up");
    });
    const later = vi.fn<EventHandler>(async () => {});
    const notify = vi.fn(async () => {});

    await expect(deliverEnvelope(envelope, [failing, later], notify)).rejects.toBeInstanceOf(EventDeliveryError);

    expect(failing).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1); // one bad consumer must not starve the others
    expect(notify).not.toHaveBeenCalled(); // notifications deferred until a clean delivery
  });

  it("does not fail the delivery when only the best-effort notification fan-out throws", async () => {
    const handler = vi.fn<EventHandler>(async () => {});
    const notify = vi.fn(async () => {
      throw new Error("slack webhook down");
    });

    await expect(deliverEnvelope(envelope, [handler], notify)).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
