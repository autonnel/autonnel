export class Market {
  private constructor(
    readonly countryCode: string,
    readonly currencyCode: string,
  ) {}
  static of(countryCode: string, currencyCode: string): Market {
    if (!countryCode || !currencyCode) {
      throw new Error("Market requires countryCode and currencyCode");
    }
    return new Market(countryCode.toUpperCase(), currencyCode.toUpperCase());
  }
  key(): string {
    return `${this.countryCode}:${this.currencyCode}`;
  }
  equals(other: Market): boolean {
    return this.countryCode === other.countryCode && this.currencyCode === other.currencyCode;
  }
}

export const DEFAULT_MARKET = Market.of("US", "USD");
