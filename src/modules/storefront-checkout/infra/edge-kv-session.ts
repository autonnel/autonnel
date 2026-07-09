import { FunnelSession } from '../domain/funnel-session';
import type { FunnelSessionStorePort } from '../application/ports/outbound';
import { CookieSigner } from './cookie-signer';
import { serializeSession, deserializeSession, type SerializedSession } from './session-serializer';

interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface EdgeKvSessionDeps {
  kv: KvLike;
  tenantId: string;
  cookieSecret: string;
}

export class EdgeKvSessionAdapter implements FunnelSessionStorePort {
  private readonly signer: CookieSigner;
  constructor(private readonly deps: EdgeKvSessionDeps) {
    this.signer = new CookieSigner(deps.cookieSecret);
  }

  private key(sessionId: string): string {
    return `session:${this.deps.tenantId}:${sessionId}`;
  }

  async load(sessionId: string): Promise<FunnelSession | null> {
    const raw = await this.deps.kv.get(this.key(sessionId));
    if (!raw) return null;
    return deserializeSession(JSON.parse(raw) as SerializedSession);
  }

  async store(session: FunnelSession, ttlSeconds: number): Promise<void> {
    await this.deps.kv.put(this.key(session.sessionId), JSON.stringify(serializeSession(session)), { expirationTtl: ttlSeconds });
  }

  // Web Crypto is async on workerd, so cookie signing is exposed as Promise-returning.
  signCookieValue(sessionId: string): Promise<string> {
    return this.signer.sign(sessionId);
  }
  verifyCookieValue(value: string): Promise<string | null> {
    return this.signer.verify(value);
  }
}
