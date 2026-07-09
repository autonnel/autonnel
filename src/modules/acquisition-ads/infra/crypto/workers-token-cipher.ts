import { SealedToken } from '../../domain/value-objects/sealed-token';
import type { TokenCipherPort } from '../../application/ports/outbound';

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64: string): BufferSource {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export class WorkersTokenCipher implements TokenCipherPort {
  private constructor(private readonly key: CryptoKey) {}

  static async fromRawKey(raw: Uint8Array): Promise<WorkersTokenCipher> {
    const key = await crypto.subtle.importKey('raw', raw.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    return new WorkersTokenCipher(key);
  }

  async seal(plaintext: string, tokenVersion: number): Promise<SealedToken> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plaintext);
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, data.buffer as ArrayBuffer);
    return SealedToken.of({ ciphertext: toB64(new Uint8Array(buf)), iv: toB64(iv), tokenVersion });
  }

  async open(token: SealedToken): Promise<string> {
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(token.iv) },
      this.key,
      fromB64(token.ciphertext),
    );
    return new TextDecoder().decode(buf);
  }
}
