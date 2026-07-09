import { PriceSnapshot } from '../value-objects/price-snapshot';

export class PriceStalenessPolicy {
  assertFresh(snapshot: PriceSnapshot, now: Date, maxAgeMs: number): void {
    if (snapshot.isStaleAt(now, maxAgeMs)) {
      throw new Error('PriceSnapshot is stale; re-resolve before capture');
    }
  }
}
