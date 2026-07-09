import type { Address } from '../value-objects';
import type { SuppressionEntry } from '../suppression-entry';

export class SuppressionPolicy {
  isSuppressed(address: Address, entries: ReadonlyArray<SuppressionEntry>): boolean {
    return entries.some(
      (e) => e.active && e.channel === address.channel && e.normalizedAddress === address.normalized,
    );
  }
}
