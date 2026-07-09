import { CredentialHash } from '../../domain/credential-hash';
import type { PasswordHasherPort } from '../../application/ports/outbound';

// Cloudflare Workers' crypto.subtle caps PBKDF2 at 100_000 iterations; a higher
// count throws NotSupportedError at verify time. Keep new hashes at the ceiling.
const ITERATIONS = 100_000;
const KEY_LEN = 32;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, key, KEY_LEN * 8,
  );
  return toHex(bits);
}

// PBKDF2 via crypto.subtle (workerd-native; no node:crypto / bcrypt).
export class WebCryptoPasswordHasher implements PasswordHasherPort {
  async hash(plaintext: string): Promise<CredentialHash> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const digest = await derive(plaintext, salt, ITERATIONS);
    return CredentialHash.fromStored(`pbkdf2$${ITERATIONS}$${toHex(salt.buffer)}$${digest}`);
  }

  async verify(plaintext: string, hash: CredentialHash): Promise<boolean> {
    const [scheme, iterationsRaw, saltHex, expected] = hash.stored.split('$');
    if (scheme !== 'pbkdf2' || !saltHex || !expected) return false;
    const iterations = Number.parseInt(iterationsRaw, 10) || ITERATIONS;
    const actual = await derive(plaintext, fromHex(saltHex), iterations);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  }
}
