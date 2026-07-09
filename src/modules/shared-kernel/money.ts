const ISO_4217 = /^[A-Z]{3}$/;

export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currencyCode: string,
  ) {}

  static of(amountMinor: number, currencyCode: string): Money {
    if (!Number.isInteger(amountMinor)) {
      throw new Error(`Money.amountMinor must be an integer (minor units), got ${amountMinor}`);
    }
    if (!ISO_4217.test(currencyCode)) {
      throw new Error(`Money.currencyCode must be an ISO-4217 alpha-3 code, got "${currencyCode}"`);
    }
    return new Money(amountMinor, currencyCode);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currencyCode !== other.currencyCode) {
      throw new Error(`cross-currency arithmetic: ${this.currencyCode} vs ${other.currencyCode}`);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor + other.amountMinor, this.currencyCode);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountMinor - other.amountMinor, this.currencyCode);
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currencyCode === other.currencyCode;
  }

  isPositive(): boolean {
    return this.amountMinor > 0;
  }

  // Floored integer fraction: floor(amountMinor * numerator / denominator), no floats.
  multiplyByFraction(numerator: number, denominator: number): Money {
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
      throw new Error('Money.multiplyByFraction requires integer numerator and denominator');
    }
    if (denominator === 0) {
      throw new Error('Money.multiplyByFraction requires a non-zero denominator');
    }
    return Money.of(Math.floor((this.amountMinor * numerator) / denominator), this.currencyCode);
  }
}
