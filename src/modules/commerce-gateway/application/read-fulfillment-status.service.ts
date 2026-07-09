import type { BackendFulfillmentReaderPort } from "./ports/outbound";
import type { BackendFulfillmentPort, BackendFulfillmentReadResult } from "./ports/inbound";
import { ExternalRef } from "../domain/value-objects/external-ref";

export class ReadFulfillmentStatusService implements BackendFulfillmentPort {
  constructor(private readonly reader: BackendFulfillmentReaderPort) {}

  async readFulfillmentStatus(backendOrderRef: string): Promise<BackendFulfillmentReadResult> {
    return this.reader.readFulfillment(ExternalRef.of(backendOrderRef));
  }
}
