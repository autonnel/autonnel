// ExternalRef wraps an opaque vendor identity (e.g. a Shopify GID); the core never parses its format.
export class ExternalRef {
  private constructor(private readonly token: string) {}
  static of(token: string): ExternalRef {
    if (!token || token.trim().length === 0) {
      throw new Error("ExternalRef requires a non-empty token");
    }
    return new ExternalRef(token);
  }
  toString(): string {
    return this.token;
  }
  equals(other: ExternalRef): boolean {
    return this.token === other.token;
  }
}
