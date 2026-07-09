import type { BackendFulfillmentReaderPort } from "../../../application/ports/outbound";
import type { BackendFulfillmentReadResult, FulfillmentStatus } from "../../../application/ports/inbound";
import { ExternalRef } from "../../../domain/value-objects/external-ref";
import { createLogger } from "@/lib/logger";
import { WooRestClient } from "./woo-rest-client";

const logger = createLogger("WooFulfillmentAdapter");

interface WooMetaItem {
  key?: string;
  value?: unknown;
}

interface WooOrderResponse {
  status?: string;
  meta_data?: WooMetaItem[];
}

const TRACKING_KEYS = ["_tracking_number", "tracking_number", "_wc_shipment_tracking_items"];
const CARRIER_KEYS = ["_tracking_provider", "tracking_provider", "carrier"];

interface TrackingInfo {
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
}

// Woo core has no first-class fulfillment object; tracking lives in order meta written by shipment
// plugins. We best-effort read the common meta keys and fall back to status-only.
function extractTracking(meta: WooMetaItem[] | undefined): TrackingInfo {
  if (!meta || meta.length === 0) return {};
  const out: TrackingInfo = {};
  for (const item of meta) {
    if (!item?.key) continue;
    if (TRACKING_KEYS.includes(item.key)) {
      if (typeof item.value === "string" && !out.trackingNumber) {
        out.trackingNumber = item.value;
      } else if (Array.isArray(item.value) && item.value.length > 0) {
        const first = (item.value[0] ?? {}) as Record<string, unknown>;
        if (typeof first.tracking_number === "string" && !out.trackingNumber) out.trackingNumber = first.tracking_number;
        if (typeof first.tracking_provider === "string" && !out.carrier) out.carrier = first.tracking_provider;
        if (typeof first.tracking_link === "string" && !out.trackingUrl) out.trackingUrl = first.tracking_link;
      }
    }
    if (CARRIER_KEYS.includes(item.key) && typeof item.value === "string" && !out.carrier) {
      out.carrier = item.value;
    }
  }
  return out;
}

function mapStatus(wooStatus: string | undefined, hasTracking: boolean): FulfillmentStatus {
  const s = (wooStatus ?? "").toLowerCase();
  if (s === "completed") return "delivered";
  if (hasTracking) return "in_transit";
  if (s === "processing" || s === "on-hold" || s === "pending") return "unfulfilled";
  return "unknown";
}

export class WooCommerceFulfillmentAdapter implements BackendFulfillmentReaderPort {
  constructor(private readonly client: WooRestClient) {}

  async readFulfillment(backendOrderRef: ExternalRef): Promise<BackendFulfillmentReadResult> {
    let order: WooOrderResponse;
    try {
      order = await this.client.request<WooOrderResponse>(
        "GET",
        `/orders/${encodeURIComponent(backendOrderRef.toString())}`,
      );
    } catch (error) {
      logger.warn("readFulfillment failed", { backendOrderRef: backendOrderRef.toString(), error });
      return { status: "unknown" };
    }
    const tracking = extractTracking(order.meta_data);
    return {
      status: mapStatus(order.status, Boolean(tracking.trackingNumber)),
      carrier: tracking.carrier,
      trackingNumber: tracking.trackingNumber,
      trackingUrl: tracking.trackingUrl,
    };
  }
}
