const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class WebCryptoHashIdentityAdapter {
  async digest(normalized: string): Promise<string> {
    const data = encoder.encode(normalized);
    const hashed = await crypto.subtle.digest('SHA-256', data);
    return toHex(hashed);
  }

  // Compute the digest once for the captured handle, then hand back a sync closure
  // that ContactHandle.fromEmail/Phone can call without re-hashing.
  async hasherFor(normalized: string): Promise<(input: string) => string> {
    const digest = await this.digest(normalized);
    return () => digest;
  }
}
