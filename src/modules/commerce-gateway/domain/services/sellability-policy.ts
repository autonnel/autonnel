import { Money } from "../../../shared-kernel/money";
import { InventorySnapshot } from "../value-objects/inventory-snapshot";
import { Sellability } from "../value-objects/sellability";

export interface SellabilityInput {
  price: Money | undefined;
  inventory: InventorySnapshot;
  now: Date;
}

export class SellabilityPolicy {
  constructor(private readonly inventoryTtlMs: number) {}

  evaluate(input: SellabilityInput): Sellability {
    if (!input.price) return Sellability.unavailable("price_unavailable");
    if (input.inventory.policy === "continue") return Sellability.sellable();
    if (input.inventory.isStale(input.now, this.inventoryTtlMs)) {
      return Sellability.unknown("stale_inventory");
    }
    if (!input.inventory.isKnown()) return Sellability.unknown("inventory_unknown");
    if ((input.inventory.available ?? 0) <= 0) return Sellability.unavailable("out_of_stock");
    return Sellability.sellable();
  }
}
