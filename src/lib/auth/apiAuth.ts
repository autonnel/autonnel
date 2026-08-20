import crypto from 'node:crypto';
import { getBasePrisma } from '@/lib/db';
import { getCache, cacheGetOrSet, CACHE_TTL } from '@/lib/adapters/cache';
import { getCurrentTenantId } from '@/lib/tenant/context';

interface CachedApiKeyData {
  userId: string;
  tenantId: string;
  expiresAt: string | null;
  writeAccess: boolean;
}

export interface ApiTokenResult {
  valid: boolean;
  error?: string;
  userId?: string;
  writeAccess?: boolean;
}

const CACHE_PREFIX = 'apikey:';

const deny = (error: string): ApiTokenResult => ({ valid: false, error });
const allow = (userId: string, writeAccess: boolean): ApiTokenResult => ({
  valid: true,
  userId,
  writeAccess,
});

function cacheKeyFor(keyHash: string): string {
  return CACHE_PREFIX + keyHash;
}

function extractBearerToken(authHeader: string | null): { token: string } | { error: string } {
  if (!authHeader) {
    return { error: 'Missing Authorization header' };
  }
  if (authHeader.indexOf('Bearer ') !== 0) {
    return { error: 'Invalid Authorization header format. Expected: Bearer <token>' };
  }
  const token = authHeader.slice(7).trim();
  return token.length === 0 ? { error: 'Empty token' } : { token };
}

function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false;
  const when = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return when < new Date();
}

function checkScope(tenantId: string, expiresAt: Date | string | null): string | null {
  if (tenantId !== getCurrentTenantId()) {
    return 'Invalid token';
  }
  if (isExpired(expiresAt)) {
    return 'API key has expired';
  }
  return null;
}

export async function validateApiToken(authHeader: string | null): Promise<ApiTokenResult> {
  const parsed = extractBearerToken(authHeader);
  if ('error' in parsed) {
    return deny(parsed.error);
  }

  const keyHash = crypto.createHash('sha256').update(parsed.token).digest('hex');

  // TTL stays CACHE_TTL.SHORT deliberately: nothing calls invalidateApiKeyCache,
  // so expiry is the ONLY thing that revokes a disabled key. cacheGetOrSet only
  // collapses concurrent misses onto one DB read + one KV write; it does not
  // extend how long a stale entry survives. Returning null for an unknown or
  // inactive key keeps it out of the cache, so scanners cannot fill KV.
  const cached = await cacheGetOrSet<CachedApiKeyData | null>(
    cacheKeyFor(keyHash),
    CACHE_TTL.SHORT,
    async () => {
      const record = await getBasePrisma().apiKey.findUnique({
        where: { keyHash },
        select: { id: true, status: true, tenantId: true, expiresAt: true, writeAccess: true },
      });
      if (!record || record.status !== 'active') return null;
      return {
        userId: record.id,
        tenantId: record.tenantId,
        expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
        writeAccess: record.writeAccess,
      };
    },
  );

  if (!cached) return deny('Invalid token');

  const scopeError = checkScope(cached.tenantId, cached.expiresAt);
  return scopeError ? deny(scopeError) : allow(cached.userId, cached.writeAccess);
}

export async function invalidateApiKeyCache(keyHash: string): Promise<void> {
  await getCache().delete(cacheKeyFor(keyHash));
}

export async function invalidateAllApiKeyCaches(): Promise<void> {
  await getCache().deletePattern(CACHE_PREFIX + '*');
}

export function createUnauthorizedResponse(error: string): Response {
  const body = {
    error: {
      message: error,
      type: 'authentication_error',
      code: 'invalid_api_key',
    },
  };
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer',
    },
  });
}
