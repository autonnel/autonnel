import type { PspSlug } from './value-objects';

export class ProviderSelectionPolicy {
  select(requested: PspSlug, configured: PspSlug[]): PspSlug {
    if (!configured.includes(requested)) {
      throw new Error(`Requested provider ${requested} is not configured for this tenant`);
    }
    return requested;
  }
}
