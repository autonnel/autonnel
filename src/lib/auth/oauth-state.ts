import { getCache } from '@/lib/adapters/cache';
import { resolveSessionSecret } from '@/lib/services/session-secret';

const STATE_TTL_SECONDS = 10 * 60;
const NONCE_PREFIX = 'oauth:state:';
const encoder = new TextEncoder();

export class OAuthStateError extends Error {
  code = 'OAUTH_STATE_INVALID' as const;
  constructor(reason: string) {
    super(`OAuth state rejected: ${reason}`);
    this.name = 'OAuthStateError';
  }
}

interface StatePayload {
  platform: string;
  tenantId: string;
  userId: string;
  nonce: string;
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function sign(body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(resolveSessionSecret('AUTH_SESSION_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body))));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// The state must be unforgeable, bound to the principal that started the flow, and single-use.
// Without all three, an attacker can start authorization for an account they control and have a
// logged-in victim complete the callback, linking that account into the victim's tenant.
export async function issueOAuthState(input: { platform: string; tenantId: string; userId: string }): Promise<string> {
  const nonce = crypto.randomUUID();
  const payload: StatePayload = { platform: input.platform, tenantId: input.tenantId, userId: input.userId, nonce };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  await getCache().set(NONCE_PREFIX + nonce, { tenantId: input.tenantId, userId: input.userId }, STATE_TTL_SECONDS);
  return `${body}.${await sign(body)}`;
}

export async function consumeOAuthState(
  state: string,
  expected: { tenantId: string; userId: string },
): Promise<{ platform: string; externalAccountId: string }> {
  const dot = state.lastIndexOf('.');
  if (dot < 0) throw new OAuthStateError('malformed');
  const body = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  if (!constantTimeEqual(await sign(body), signature)) throw new OAuthStateError('bad signature');

  let payload: StatePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as StatePayload;
  } catch {
    throw new OAuthStateError('unreadable payload');
  }
  if (payload.tenantId !== expected.tenantId) throw new OAuthStateError('tenant mismatch');
  if (payload.userId !== expected.userId) throw new OAuthStateError('principal mismatch');

  const cache = getCache();
  const record = await cache.get<{ tenantId: string; userId: string }>(NONCE_PREFIX + payload.nonce);
  if (!record) throw new OAuthStateError('unknown or already-used state');
  await cache.delete(NONCE_PREFIX + payload.nonce);

  // externalAccountId is chosen later from the discovered destinations; it is never taken from
  // the state, so an attacker cannot pre-seed an account id here.
  return { platform: payload.platform, externalAccountId: '' };
}
