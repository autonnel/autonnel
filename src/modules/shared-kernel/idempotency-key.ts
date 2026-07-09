export class IdempotencyKey {
  private constructor(readonly value: string) {}

  static of(token: string): IdempotencyKey {
    const normalized = token.trim();
    if (!normalized) throw new Error("IdempotencyKey must not be empty");
    return new IdempotencyKey(normalized);
  }

  static derive(...parts: string[]): IdempotencyKey {
    return new IdempotencyKey(parts.map((p) => p.trim()).join(":"));
  }

  // Constant-time-ish comparison: never short-circuit on first mismatch; length divergence
  // returns false without leaking position. Avoids node:crypto so it runs unchanged on workerd.
  matches(other: IdempotencyKey): boolean {
    const a = this.value;
    const b = other.value;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  toString(): string {
    return this.value;
  }
}

// Constant-time string comparison for signature/secret checks. Never short-circuits on
// the first mismatch; length divergence returns false without leaking position. Avoids
// node:crypto so it runs unchanged on workerd.
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
