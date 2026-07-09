import { createLogger } from "@/lib/logger";
import { resolveTemplateLanguage } from "@/lib/email-templates/default-templates";
import type { Order } from "../domain/order";
import type { OfferLineSnapshot } from "../domain/value-objects";
import type { BrandingInfoPort, LifecycleTemplateKey, MessagingPort } from "./ports";

const logger = createLogger("OrderFulfillment:EmitLifecycleEmail");

function formatMoney(amountMinor: number, currencyCode: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currencyCode}`;
  }
}

function splitName(name: string | null | undefined): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function lineRow(line: OfferLineSnapshot, currency: string, locale: string): string {
  const title = escapeHtml(line.title);
  const total = formatMoney(line.lineTotal.amountMinor, currency, locale);
  return `<tr><td style="padding:6px 0;">${title} &times; ${line.quantity}</td><td align="right" style="padding:6px 0;">${total}</td></tr>`;
}

function orderItemsHtml(lines: readonly OfferLineSnapshot[], currency: string, locale: string): string {
  const rows = lines.map((l) => lineRow(l, currency, locale)).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">${rows}</table>`;
}

function formatDate(date: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone }).format(date);
}

export type DisableNotificationsResolver = () => Promise<boolean>;

export class EmitLifecycleEmailService {
  constructor(
    private readonly messaging: MessagingPort,
    private readonly disableNotifications: DisableNotificationsResolver,
    private readonly branding: BrandingInfoPort,
  ) {}

  async emit(order: Order, templateKey: LifecycleTemplateKey): Promise<void> {
    const autonnelSends = await this.disableNotifications();
    if (!autonnelSends) {
      logger.info("Lifecycle email skipped; backend sends", { orderId: order.id, templateKey });
      return;
    }

    const locale = resolveTemplateLanguage(order.checkoutLanguage);
    const currency = order.capturedTotal.currencyCode;
    const refundedMinor = order.refunds.reduce((acc, r) => acc + r.amount.amountMinor, 0);
    const subtotalMinor = order.lines.reduce((acc, l) => acc + l.lineTotal.amountMinor, 0);
    const { first, last } = splitName(order.customer.name);
    const address = order.contact?.address;
    const branding = await this.branding.load();
    const today = formatDate(new Date(), locale, branding.timeZone);

    await this.messaging.send({
      channel: "EMAIL",
      templateKey,
      recipient: order.customer.email,
      idempotencyKey: `order:${order.id}:${templateKey}`,
      locale,
      mergeVariables: {
        orderNumber: order.orderNumber,
        customerEmail: order.customer.email,
        customerFullName: order.customer.name ?? "",
        customerFirstName: first,
        customerLastName: last,
        customerPhone: order.customer.phone ?? "",
        currency,
        orderItemsHtml: orderItemsHtml(order.lines, currency, locale),
        orderSubtotal: formatMoney(subtotalMinor, currency, locale),
        orderTotal: formatMoney(order.capturedTotal.amountMinor, currency, locale),
        shippingAddress: address?.line1 ?? "",
        shippingAddress2: address?.line2 ?? "",
        shippingCity: address?.city ?? "",
        shippingState: address?.region ?? "",
        shippingPostalCode: address?.postalCode ?? "",
        shippingCountry: address?.countryCode ?? "",
        trackingNumber: order.tracking?.trackingNumber ?? "",
        trackingUrl: order.tracking?.url ?? "",
        refundAmount: formatMoney(refundedMinor, currency, locale),
        orderDate: today,
        deliveredDate: today,
        refundDate: today,
        carrierName: order.tracking?.carrier ?? "",
        estimatedDelivery: "",
        orderShipping: "",
        orderTax: "",
        orderDiscount: "",
        couponCode: "",
        couponDiscount: "",
        refundReason: "",
        storeName: branding.storeName,
        storeUrl: branding.storeUrl,
        storeEmail: branding.storeEmail,
        storeLogo: branding.storeLogo,
      },
    });
  }
}
