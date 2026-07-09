import type { SecretGeneratorPort } from '../../application/ports/outbound';

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class WebCryptoSecretGenerator implements SecretGeneratorPort {
  generatePlaintext(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return `ak_${toHex(bytes.buffer)}`;
  }

  async hashSecret(plaintext: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plaintext));
    return toHex(digest);
  }

  constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
}
