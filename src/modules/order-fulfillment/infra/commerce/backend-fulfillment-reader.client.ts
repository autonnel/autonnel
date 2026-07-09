import type {
  BackendFulfillmentReaderPort,
  BackendFulfillmentResult,
} from "../../application/ports";
import { normalizeFulfillment } from "../../domain/fulfillment-status";
import { TrackingInfo } from "../../domain/tracking-info";

export interface CommerceBackendFulfillmentPort {
  readFulfillmentStatus(backendOrderRef: string): Promise<{
    status?: string;
    trackingNumber?: string;
    trackingCarrier?: string;
    trackingUrl?: string;
  }>;
}

export class CommerceGatewayFulfillmentReader implements BackendFulfillmentReaderPort {
  constructor(private readonly gateway: CommerceBackendFulfillmentPort) {}

  async readFulfillment(backendOrderRef: string): Promise<BackendFulfillmentResult> {
    const raw = await this.gateway.readFulfillmentStatus(backendOrderRef);
    const status = normalizeFulfillment(raw.status);
    const tracking =
      raw.trackingNumber || raw.trackingCarrier || raw.trackingUrl
        ? TrackingInfo.of({
            carrier: raw.trackingCarrier,
            trackingNumber: raw.trackingNumber,
            url: raw.trackingUrl,
          })
        : undefined;
    return { status, tracking };
  }
}
