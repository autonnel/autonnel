export type SellabilityVerdict = "sellable" | "unavailable" | "unknown";

export class Sellability {
  private constructor(readonly verdict: SellabilityVerdict, readonly reason?: string) {}
  static sellable(): Sellability {
    return new Sellability("sellable");
  }
  static unavailable(reason: string): Sellability {
    return new Sellability("unavailable", reason);
  }
  static unknown(reason: string): Sellability {
    return new Sellability("unknown", reason);
  }
  isSellable(): boolean {
    return this.verdict === "sellable";
  }
}
