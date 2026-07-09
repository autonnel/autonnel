const encoder = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class CookieSigner {
  constructor(private readonly secret: string) {}

  async sign(sessionId: string): Promise<string> {
    const key = await importKey(this.secret);
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(sessionId));
    return `${sessionId}.${toHex(mac)}`;
  }

  async verify(value: string): Promise<string | null> {
    const dot = value.lastIndexOf('.');
    if (dot < 0) return null;
    const sessionId = value.slice(0, dot);
    const expected = await this.sign(sessionId);
    // constant-time-ish compare; lengths equal for same secret
    if (expected.length !== value.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ value.charCodeAt(i);
    return diff === 0 ? sessionId : null;
  }
}
