import { describe, it, expect, vi } from "vitest";
import { Money } from "@/modules/shared-kernel/money";
import { Order } from "../domain/order";
import { OfferLineSnapshot, CustomerSnapshot, ContactSnapshot } from "../domain/value-objects";
import { EmitLifecycleEmailService } from "./emit-lifecycle-email.service";
import type { BrandingInfoPort, LifecycleTemplateKey, MessagingPort, SendNotificationInput } from "./ports";
import { buildDefaultVersion } from "@/modules/messaging/infra/templates/default-version.factory";

const branding: BrandingInfoPort = {
  load: async () => ({
    storeName: "Acme",
    storeUrl: "https://acme.test",
    storeEmail: "hello@acme.test",
    storeLogo: "https://cdn.acme.test/logo.png",
    timeZone: "UTC",
  }),
};

function order(checkoutLanguage: string | null) {
  return Order.createFromPaidSale({
    id: "ord_fr",
    orderNumber: "2002",
    saleRef: "sale_fr",
    capturedTotal: Money.of(9900, "EUR"),
    checkoutLanguage,
    lines: [
      OfferLineSnapshot.of({
        externalRef: "v1",
        title: "Widget",
        quantity: 1,
        unitPrice: Money.of(9900, "EUR"),
        lineTotal: Money.of(9900, "EUR"),
      }),
    ],
    customer: CustomerSnapshot.of({ email: "client@example.fr", name: "Marie Dupont" }),
    contact: ContactSnapshot.of({
      address: { line1: "1 Rue de la Paix", city: "Paris", countryCode: "FR", postalCode: "75002" },
    }),
  });
}

// Captures what the order context hands to messaging, so the test can render with the SAME locale
// the send path would use — proving "fr order → fr template", not just "fr renders fr in isolation".
function capturingMessaging(): { port: MessagingPort; last: () => SendNotificationInput } {
  const send = vi.fn().mockResolvedValue(undefined);
  return { port: { send }, last: () => send.mock.calls[0][0] as SendNotificationInput };
}

const LIFECYCLE_KEYS: LifecycleTemplateKey[] = [
  "order.receipt",
  "order.shipped",
  "order.delivered",
  "order.refunded",
];

describe("lifecycle emails render in the customer's checkout language", () => {
  it("an fr order renders the fr receipt (French subject + body), not the en fallback", async () => {
    const m = capturingMessaging();
    const svc = new EmitLifecycleEmailService(m.port, async () => true, branding);

    await svc.emit(order("fr"), "order.receipt");
    const locale = m.last().locale!;
    expect(locale).toBe("fr");

    const version = await buildDefaultVersion("order.receipt", locale);
    expect(version).not.toBeNull();
    expect(version!.locale).toBe("fr");
    expect(version!.subject).toContain("Votre recu pour la commande");
    expect(version!.html).toContain("Merci pour votre achat");
    // proves it is not silently the English template
    expect(version!.subject).not.toContain("Your receipt");
  });

  it("an en order renders the en receipt (control)", async () => {
    const m = capturingMessaging();
    const svc = new EmitLifecycleEmailService(m.port, async () => true, branding);

    await svc.emit(order(null), "order.receipt");
    const version = await buildDefaultVersion("order.receipt", m.last().locale!);
    expect(version!.subject).toContain("Your receipt for order");
  });

  it("renders every lifecycle key for an fr order in French", async () => {
    for (const key of LIFECYCLE_KEYS) {
      const m = capturingMessaging();
      const svc = new EmitLifecycleEmailService(m.port, async () => true, branding);
      await svc.emit(order("fr"), key);
      const version = await buildDefaultVersion(key, m.last().locale!);
      expect(version, `version for ${key}`).not.toBeNull();
      expect(version!.locale, `locale for ${key}`).toBe("fr");
    }
  });

  it("an unsupported language clamps the send locale to en so copy and formatting agree", async () => {
    const m = capturingMessaging();
    const svc = new EmitLifecycleEmailService(m.port, async () => true, branding);

    await svc.emit(order("it"), "order.receipt");
    // The service clamps unsupported languages to en up front, so the locale handed to messaging
    // matches the rendered template and the date/currency formatting (no raw-locale leakage).
    const locale = m.last().locale!;
    expect(locale).toBe("en");

    const version = await buildDefaultVersion("order.receipt", locale);
    expect(version!.subject).toContain("Your receipt for order");
  });
});
