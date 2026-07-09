import { Money } from "../../../shared-kernel/money";
import { Market } from "./market";

export interface PresentmentPrice {
  market: Market;
  price: Money;
  compareAtPrice?: Money;
}

interface PriceEntry {
  price: Money;
  compareAtPrice?: Money;
}

export class PresentmentPriceMap {
  private constructor(private readonly byKey: Map<string, PriceEntry>) {}
  static from(prices: PresentmentPrice[]): PresentmentPriceMap {
    const m = new Map<string, PriceEntry>();
    for (const p of prices) m.set(p.market.key(), { price: p.price, compareAtPrice: p.compareAtPrice });
    return new PresentmentPriceMap(m);
  }
  resolve(market: Market): Money | undefined {
    return this.byKey.get(market.key())?.price;
  }
  resolveByCurrency(currencyCode: string): Money | undefined {
    const wanted = currencyCode.toUpperCase();
    for (const entry of this.byKey.values()) {
      if (entry.price.currencyCode === wanted) return entry.price;
    }
    return undefined;
  }
  resolveCompare(market: Market): Money | undefined {
    return this.byKey.get(market.key())?.compareAtPrice;
  }
  resolveCompareByCurrency(currencyCode: string): Money | undefined {
    const wanted = currencyCode.toUpperCase();
    for (const entry of this.byKey.values()) {
      if (entry.price.currencyCode === wanted) return entry.compareAtPrice;
    }
    return undefined;
  }
  first(): Money | undefined {
    for (const entry of this.byKey.values()) return entry.price;
    return undefined;
  }
  firstCompare(): Money | undefined {
    for (const entry of this.byKey.values()) return entry.compareAtPrice;
    return undefined;
  }
  isEmpty(): boolean {
    return this.byKey.size === 0;
  }
}
