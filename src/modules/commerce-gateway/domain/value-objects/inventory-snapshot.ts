export type InventoryPolicy = "deny" | "continue" | "unknown";

export class InventorySnapshot {
  private constructor(
    readonly available: number | null,
    readonly policy: InventoryPolicy,
    readonly asOf: Date,
  ) {}
  static of(available: number | null, policy: InventoryPolicy, asOf: Date): InventorySnapshot {
    return new InventorySnapshot(available, policy, asOf);
  }
  isKnown(): boolean {
    return this.available !== null && this.policy !== "unknown";
  }
  isStale(now: Date, ttlMs: number): boolean {
    return now.getTime() - this.asOf.getTime() > ttlMs;
  }
}
