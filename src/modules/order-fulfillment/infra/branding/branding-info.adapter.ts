import { loadStoreIdentity } from "@/lib/branding/store-identity";
import type { BrandingInfo, BrandingInfoPort } from "../../application/ports";

// Resolves the store identity used by lifecycle email templates from tenant settings.
export class ConfigBrandingInfoAdapter implements BrandingInfoPort {
  async load(): Promise<BrandingInfo> {
    return loadStoreIdentity();
  }
}
