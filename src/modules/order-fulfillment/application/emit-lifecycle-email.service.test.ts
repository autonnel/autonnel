import { describe, it, expect, vi } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import {
  OfferLineSnapshot,
  CustomerSnapshot,
  ContactSnapshot,
  RefundRecordRef,
} from "../domain/value-objects";
import { TrackingInfo } from "../domain/tracking-info";
import { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";
import type { BrandingInfoPort, MessagingPort } from "./ports";

const branding: BrandingInfoPort = {
  load: async () => ({
    storeName: "Acme",
    storeUrl: "https://acme.test",
    storeEmail: "hello@acme.test",
    storeLogo: "https://cdn.acme.test/logo.png",
    timeZone: "UTC",
  }),
};

function order(checkoutLanguage: string | null = null) {
  return Order.createFromPaidSale({
    id: "ord_1",
    orderNumber: "1001",
    saleRef: "sale_1",
    capturedTotal: Money.of(12000, "USD"),
    checkoutLanguage,
    lines: [
      OfferLineSnapshot.of({
        externalRef: "v1",
        title: "Widget",
        quantity: 2,
        unitPrice: Money.of(6000, "USD"),
        lineTotal: Money.of(12000, "USD"),
      }),
    ],
    customer: CustomerSnapshot.of({ email: "a@b.co", name: "Ann Lee", phone: "+1555" }),
    contact: ContactSnapshot.of({
      address: {
        line1: "1 Main St",
        line2: "Apt 7",
        city: "Springfield",
        region: "IL",
        countryCode: "US",
        postalCode: "62704",
      },
    }),
  });
}

describe("EmitLifecycleEmailService", () => {
  it("builds the full lifecycle variable map and sends when autonnel owns emails", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const messaging: MessagingPort = { send };
    const svc = new EmitLifecycleEmailService(messaging, async () => true, branding);

    await svc.emit(order(), "order.receipt");

    expect(send).toHaveBeenCalledTimes(1);
    const arg = send.mock.calls[0][0];
    expect(arg.templateKey).toBe("order.receipt");
    expect(arg.recipient).toBe("a@b.co");
    expect(arg.idempotencyKey).toBe("order:ord_1:order.receipt");

    const v = arg.mergeVariables;
    expect(v.orderNumber).toBe("1001");
    expect(v.customerFullName).toBe("Ann Lee");
    expect(v.customerFirstName).toBe("Ann");
    expect(v.customerLastName).toBe("Lee");
    expect(v.customerEmail).toBe("a@b.co");
    expect(v.customerPhone).toBe("+1555");
    expect(typeof v.orderTotal).toBe("string");
    expect(v.orderTotal).toContain("120");
    expect(v.orderSubtotal).toContain("120");
    expect(String(v.orderItemsHtml)).toContain("Widget");
    expect(String(v.orderItemsHtml)).toContain("&times; 2");
    expect(v.shippingAddress).toBe("1 Main St");
    expect(v.shippingAddress2).toBe("Apt 7");
    expect(v.shippingCity).toBe("Springfield");
    expect(v.shippingState).toBe("IL");
    expect(v.shippingPostalCode).toBe("62704");
    expect(v.shippingCountry).toBe("US");
    expect(v.storeName).toBe("Acme");
    expect(v.storeUrl).toBe("https://acme.test");
    expect(v.storeEmail).toBe("hello@acme.test");
    expect(v.storeLogo).toBe("https://cdn.acme.test/logo.png");
    // hidden-via-conditionals values are empty strings so blocks drop cleanly
    expect(v.orderShipping).toBe("");
    expect(v.orderTax).toBe("");
    expect(v.couponCode).toBe("");
  });

  it("populates tracking and refund variables", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const messaging: MessagingPort = { send };
    const svc = new EmitLifecycleEmailService(messaging, async () => true, branding);

    const o = order();
    o.applyFulfillment({
      backendStatus: "in_transit" as never,
      tracking: TrackingInfo.of({ carrier: "UPS", trackingNumber: "1Z999", url: "https://t.test/1Z999" }),
    });
    o.recordRefund(RefundRecordRef.of({ transactionId: "tx_1", amount: Money.of(5000, "USD") }));

    await svc.emit(o, "order.shipped");

    const v = send.mock.calls[0][0].mergeVariables;
    expect(v.trackingNumber).toBe("1Z999");
    expect(v.trackingUrl).toBe("https://t.test/1Z999");
    expect(v.carrierName).toBe("UPS");
    expect(v.refundAmount).toContain("50");
  });

  it("passes the order's checkout language as the send locale", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const messaging: MessagingPort = { send };
    const svc = new EmitLifecycleEmailService(messaging, async () => true, branding);

    await svc.emit(order("fr"), "order.receipt");

    expect(send.mock.calls[0][0].locale).toBe("fr");
  });

  it("clamps an unsupported checkout language to en so copy, date and money stay consistent", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const messaging: MessagingPort = { send };
    const svc = new EmitLifecycleEmailService(messaging, async () => true, branding);

    await svc.emit(order("zh-CN"), "order.receipt");

    const arg = send.mock.calls[0][0];
    expect(arg.locale).toBe("en");
    // en formatting: ASCII currency + no CJK date characters
    expect(String(arg.mergeVariables.orderDate)).not.toMatch(/[一-鿿]/);
    expect(String(arg.mergeVariables.orderTotal)).toContain("$");
  });

  it("maps a region-suffixed supported language to its base (fr-CA -> fr)", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const messaging: MessagingPort = { send };
    const svc = new EmitLifecycleEmailService(messaging, async () => true, branding);

    await svc.emit(order("fr-CA"), "order.receipt");

    expect(send.mock.calls[0][0].locale).toBe("fr");
  });

  it("falls back to en when the order has no checkout language", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const messaging: MessagingPort = { send };
    const svc = new EmitLifecycleEmailService(messaging, async () => true, branding);

    await svc.emit(order(null), "order.receipt");

    expect(send.mock.calls[0][0].locale).toBe("en");
  });

  it("skips when disableNotifications is off (backend owns emails)", async () => {
    const send = vi.fn();
    const messaging: MessagingPort = { send };
    const svc = new EmitLifecycleEmailService(messaging, async () => false, branding);

    await svc.emit(order(), "order.shipped");

    expect(send).not.toHaveBeenCalled();
  });
});
