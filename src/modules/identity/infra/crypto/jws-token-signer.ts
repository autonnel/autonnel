import type { TokenSignerPort } from '../../application/ports/outbound';

function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

// Async because workerd's crypto.subtle has no synchronous HMAC.
export class JwsTokenSigner implements TokenSignerPort {
  private readonly keyPromise: Promise<CryptoKey>;

  constructor(secret: string) {
    this.keyPromise = crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
    );
  }

  async sign(claims: { sessionId: string }): Promise<string> {
    const key = await this.keyPromise;
    const payload = b64url(new TextEncoder().encode(JSON.stringify(claims)));
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    return `${payload}.${b64url(new Uint8Array(mac))}`;
  }

  async verify(token: string): Promise<{ sessionId: string } | null> {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const key = await this.keyPromise;
    let ok: boolean;
    try {
      ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig) as BufferSource, new TextEncoder().encode(payload));
    } catch {
      return null;
    }
    if (!ok) return null;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
      return typeof parsed.sessionId === 'string' ? { sessionId: parsed.sessionId } : null;
    } catch {
      return null;
    }
  }
}
