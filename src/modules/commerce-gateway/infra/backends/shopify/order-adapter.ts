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

  private lineItems(input: HandoffOrderInput) {
    return input.lines.map((l) => ({ variantId: l.variantRef, quantity: l.quantity }));
  }

  private guard(userErrors: ShopifyUserError[] | undefined): void {
    if (userErrors && userErrors.length > 0) throw this.classifier.fromUserErrors(userErrors);
  }

  private async viaOrderCreate(input: HandoffOrderInput, idempotencyKey: string): Promise<BackendOrderCreateResult> {
    const order: Record<string, unknown> = {
      lineItems: this.lineItems(input),
      financialStatus: "PAID",
      email: input.customer.email,
    };
    if (input.tags && input.tags.length > 0) order.tags = input.tags;
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
    const draftInput: Record<string, unknown> = { lineItems: this.lineItems(input), email: input.customer.email };
    if (input.tags && input.tags.length > 0) draftInput.tags = input.tags;
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
