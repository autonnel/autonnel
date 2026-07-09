// Opaque KDF output. `stored` is the only accessor; toString/toJSON redact so the
// hash can never leak into logs, errors, or domain events (security invariant).
export class CredentialHash {
  private constructor(readonly stored: string) {}

  static fromStored(stored: string): CredentialHash {
    if (!stored) throw new Error('CredentialHash requires a stored value');
    return new CredentialHash(stored);
  }

  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }
}
