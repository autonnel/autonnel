import { Money } from "../../../shared-kernel/money";
import { Market } from "../value-objects/market";
import { PresentmentPriceMap } from "../value-objects/presentment-price";

export class PriceResolver {
  resolve(prices: PresentmentPriceMap, market: Market, defaultMarket?: Market): Money | undefined {
    const direct = prices.resolve(market);
    if (direct) return direct;
    if (defaultMarket) return prices.resolve(defaultMarket);
    return undefined;
  }
}
