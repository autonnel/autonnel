import type { BackendFulfillmentReaderPort } from "../../../application/ports/outbound";
import type { BackendFulfillmentReadResult, FulfillmentStatus } from "../../../application/ports/inbound";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { ShopifyGraphqlClient } from "./shopify-graphql-client";

const ORDER_FULFILLMENTS = `
query OrderFulfillments($id: ID!) {
  order(id: $id) {
    fulfillments(first: 10) {
      displayStatus
      trackingInfo { company number url }
    }
  }
}`;

interface FulfillmentNode {
  displayStatus: string | null;
  trackingInfo: Array<{ company?: string | null; number?: string | null; url?: string | null }>;
}

function mapStatus(displayStatus: string | null): FulfillmentStatus {
  switch ((displayStatus ?? "").toUpperCase()) {
    case "DELIVERED":
      return "delivered";
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "ATTEMPTED_DELIVERY":
    case "CONFIRMED":
    case "IN_PROGRESS":
      return "in_transit";
    case "":
      return "unknown";
    default:
      return "unknown";
  }
}

export class ShopifyFulfillmentAdapter implements BackendFulfillmentReaderPort {
  constructor(private readonly client: ShopifyGraphqlClient) {}

  async readFulfillment(backendOrderRef: ExternalRef): Promise<BackendFulfillmentReadResult> {
    const data = await this.client.query<{ order: { fulfillments: FulfillmentNode[] } | null }>(
      ORDER_FULFILLMENTS,
      { id: backendOrderRef.toString() },
    );
    const fulfillments = data.order?.fulfillments ?? [];
    if (fulfillments.length === 0) return { status: "unfulfilled" };

    const latest = fulfillments[fulfillments.length - 1];
    const tracking = latest.trackingInfo[0];
    return {
      status: mapStatus(latest.displayStatus),
      carrier: tracking?.company ?? undefined,
      trackingNumber: tracking?.number ?? undefined,
      trackingUrl: tracking?.url ?? undefined,
    };
  }
}
