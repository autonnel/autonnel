import type { BackendOrderPort, BackendOrderCreateResult } from "../../../application/ports/outbound";
import type { HandoffOrderInput } from "../../../domain/services/handoff-translator";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { WooRestClient } from "./woo-rest-client";

interface WooOrderResponse {
  id: number;
}

interface WooLineItemInput {
  product_id: number;
  variation_id?: number;
  quantity: number;
}

interface WooAddress {
  first_name?: string;
  last_name?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
}

function splitName(fullName: unknown): { first_name?: string; last_name?: string } {
  if (typeof fullName !== "string" || !fullName.trim()) return {};
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0] };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] };
}

function addressFrom(customer: Record<string, unknown>): WooAddress {
  const name = splitName(customer.fullName);
  const ship = (customer.shippingAddress ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
  return {
    ...name,
    email: str(customer.email),
    address_1: str(ship.line1),
    address_2: str(ship.line2),
    city: str(ship.city),
    state: str(ship.region),
    postcode: str(ship.postalCode),
    country: str(ship.countryCode),
  };
}

// HandoffLineSnapshot only carries {variantRef, quantity}; Woo /orders needs product_id (+ optional
// variation_id). A ref that is a parent product resolves directly; otherwise it is treated as a
// variation and we find its parent by scanning products that include the variation.
async function resolveLineItem(
  client: WooRestClient,
  variantRef: string,
  quantity: number,
): Promise<WooLineItemInput> {
  const id = Number(variantRef);
  if (!Number.isFinite(id) || id <= 0) throw new Error(`Invalid WooCommerce variant ref: ${variantRef}`);
  try {
    await client.request("GET", `/products/${id}`);
    return { product_id: id, quantity };
  } catch {
    const products = await client.request<Array<{ id: number; variations?: number[] }>>("GET", "/products", {
      query: { include_variations: id, per_page: 100 },
    });
    for (const product of products) {
      if (product.variations && product.variations.includes(id)) {
        return { product_id: product.id, variation_id: id, quantity };
      }
    }
    throw new Error(`Cannot resolve WooCommerce product for variant ref ${variantRef}`);
  }
}

export class WooCommerceOrderAdapter implements BackendOrderPort {
  constructor(private readonly client: WooRestClient) {}

  async createPaidOrder(input: HandoffOrderInput, idempotencyKey: string): Promise<BackendOrderCreateResult> {
    const lineItems = await Promise.all(
      input.lines.map((l) => resolveLineItem(this.client, l.variantRef, l.quantity)),
    );
    const address = addressFrom(input.customer);
    const body: Record<string, unknown> = {
      status: "processing",
      set_paid: true,
      currency: input.grandTotal.currencyCode,
      billing: address,
      shipping: address,
      line_items: lineItems,
    };
    if (input.discount) {
      body.coupon_lines = [{ code: input.discount.code }];
    }
    // WooCommerce orders have no native tags; the parent link rides along as order meta_data.
    if (input.tags && input.tags.length > 0) {
      body.meta_data = input.tags.map((value) => ({ key: "autonnel_tag", value }));
    }
    const created = await this.client.request<WooOrderResponse>("POST", "/orders", { body, idempotencyKey });
    return { backendOrderRef: ExternalRef.of(String(created.id)) };
  }
}
