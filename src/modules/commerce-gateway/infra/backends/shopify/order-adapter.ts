import type { BackendOrderPort, BackendOrderCreateResult } from "../../../application/ports/outbound";
import type { HandoffOrderInput } from "../../../domain/services/handoff-translator";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { ErrorClassifier, type ShopifyUserError } from "../../../domain/services/error-classifier";
import { ShopifyGraphqlClient } from "./shopify-graphql-client";

const ORDER_CREATE = `
mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) {
    order { id }
    userErrors { field message }
  }
}`;

const DRAFT_CREATE = `
mutation DraftOrderCreate($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) { draftOrder { id } userErrors { field message } }
}`;

const DRAFT_COMPLETE = `
mutation DraftOrderComplete($id: ID!) {
  draftOrderComplete(id: $id, paymentPending: false) {
    draftOrder { order { id } }
    userErrors { field message }
  }
}`;

export interface ShopifyOrderOptions {
  disableNotifications: boolean;
}

const MAJOR_TO_MINOR = 100;

const majorAmount = (minor: number): string => (minor / MAJOR_TO_MINOR).toFixed(2);

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

// Shopify MailingAddressInput, built from the checkout buyer (same source fields as the Woo adapter).
function mailingAddress(customer: Record<string, unknown>): Record<string, string> | undefined {
  const ship = (customer.shippingAddress ?? {}) as Record<string, unknown>;
  const parts = (str(customer.fullName) ?? "").trim().split(/\s+/).filter(Boolean);
  const address: Record<string, string | undefined> = {
    firstName: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0],
    lastName: parts.length > 1 ? parts[parts.length - 1] : undefined,
    address1: str(ship.line1),
    address2: str(ship.line2),
    city: str(ship.city),
    provinceCode: str(ship.region),
    zip: str(ship.postalCode),
    countryCode: str(ship.countryCode),
  };
  if (!address.address1 && !address.city) return undefined;
  return Object.fromEntries(Object.entries(address).filter((e): e is [string, string] => !!e[1]));
}

function buyerFields(customer: Record<string, unknown>): Record<string, unknown> {
  const address = mailingAddress(customer);
  return {
    email: str(customer.email),
    ...(address ? { shippingAddress: address, billingAddress: address } : {}),
  };
}

export class ShopifyOrderAdapter implements BackendOrderPort {
  private readonly classifier = new ErrorClassifier();

  constructor(
    private readonly client: ShopifyGraphqlClient,
    private readonly options: ShopifyOrderOptions,
  ) {}

  async createPaidOrder(input: HandoffOrderInput, idempotencyKey: string): Promise<BackendOrderCreateResult> {
    return this.options.disableNotifications
      ? this.viaOrderCreate(input, idempotencyKey)
      : this.viaDraftOrder(input, idempotencyKey);
  }

  private lineItems(input: HandoffOrderInput, price: "order" | "draft") {
    return input.lines.map((l) => {
      const amount = { amount: majorAmount(l.unitPriceMinor), currencyCode: l.currencyCode };
      return {
        variantId: l.variantRef,
        quantity: l.quantity,
        ...(price === "order" ? { priceSet: { shopMoney: amount } } : { originalUnitPriceWithCurrency: amount }),
      };
    });
  }

  private guard(userErrors: ShopifyUserError[] | undefined): void {
    if (userErrors && userErrors.length > 0) throw this.classifier.fromUserErrors(userErrors);
  }

  private async viaOrderCreate(input: HandoffOrderInput, idempotencyKey: string): Promise<BackendOrderCreateResult> {
    const order: Record<string, unknown> = {
      currency: input.grandTotal.currencyCode,
      lineItems: this.lineItems(input, "order"),
      financialStatus: "PAID",
      ...buyerFields(input.customer),
    };
    if (input.tags && input.tags.length > 0) order.tags = input.tags;
    if (input.discount) {
      order.discountCode = {
        orderFixedDiscountCode: {
          code: input.discount.code,
          amountSet: { shopMoney: { amount: majorAmount(input.discount.amountMinor), currencyCode: input.discount.currencyCode } },
        },
      };
    }
    const data = await this.client.query<{
      orderCreate: { order: { id: string } | null; userErrors: ShopifyUserError[] };
    }>(ORDER_CREATE, {
      order,
      options: { sendReceipt: false, sendFulfillmentReceipt: false },
    }, idempotencyKey);
    this.guard(data.orderCreate.userErrors);
    return { backendOrderRef: ExternalRef.of(data.orderCreate.order!.id) };
  }

  private async viaDraftOrder(input: HandoffOrderInput, idempotencyKey: string): Promise<BackendOrderCreateResult> {
    const draftInput: Record<string, unknown> = {
      presentmentCurrencyCode: input.grandTotal.currencyCode,
      lineItems: this.lineItems(input, "draft"),
      ...buyerFields(input.customer),
    };
    if (input.tags && input.tags.length > 0) draftInput.tags = input.tags;
    if (input.discount) {
      draftInput.appliedDiscount = {
        value: Number(majorAmount(input.discount.amountMinor)),
        valueType: "FIXED_AMOUNT",
        title: input.discount.code,
      };
    }
    const created = await this.client.query<{
      draftOrderCreate: { draftOrder: { id: string } | null; userErrors: ShopifyUserError[] };
    }>(DRAFT_CREATE, {
      input: draftInput,
    }, idempotencyKey);
    this.guard(created.draftOrderCreate.userErrors);

    const completed = await this.client.query<{
      draftOrderComplete: { draftOrder: { order: { id: string } } | null; userErrors: ShopifyUserError[] };
    }>(DRAFT_COMPLETE, { id: created.draftOrderCreate.draftOrder!.id }, idempotencyKey);
    this.guard(completed.draftOrderComplete.userErrors);

    return { backendOrderRef: ExternalRef.of(completed.draftOrderComplete.draftOrder!.order.id) };
  }
}
