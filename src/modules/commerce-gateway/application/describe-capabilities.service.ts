import type { BackendCatalogPort } from "./ports/outbound";
import { CapabilityProfile } from "../domain/value-objects/capability-profile";

export class DescribeBackendCapabilitiesService {
  constructor(private readonly backendCatalog: BackendCatalogPort) {}
  async execute(): Promise<CapabilityProfile> {
    return this.backendCatalog.describeCapabilities();
  }
}
