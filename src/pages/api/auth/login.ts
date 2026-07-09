import type { APIContext } from 'astro';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps, jsonResponse, sessionCookie } from '@/composition/identity-deps';
import { getClientIp } from '@/lib/api/client-ip';
import { enforceRateLimit, rateLimitKey, RATE_LIMITS } from '@/lib/adapters/rate-limit';

function tooManyAttempts(retryAfterSeconds: number): Response {
  const res = jsonResponse({ error: 'Too many login attempts. Please try again later.' }, 429);
  res.headers.set('retry-after', String(retryAfterSeconds));
  return res;
}

export async function POST(context: APIContext): Promise<Response> {
  const identity = makeIdentity(resolveIdentityDeps(context));

  let body: { email?: string; username?: string; password?: string };
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }
  const identifier = body.username ?? body.email;
  if (!identifier || !body.password) {
    return jsonResponse({ error: 'Email and password required' }, 400);
  }

  const ip = getClientIp(context.request);
  const normalizedId = identifier.trim().toLowerCase();
  // Brute-force guard: cap attempts per account identifier and per source IP. Returning a generic
  // 429 (same for known and unknown accounts) keeps account existence non-observable.
  const [byId, byIp] = await Promise.all([
    enforceRateLimit(rateLimitKey('login:id', normalizedId), RATE_LIMITS.LOGIN_PER_IDENTIFIER),
    enforceRateLimit(rateLimitKey('login:ip', ip), RATE_LIMITS.LOGIN_PER_IP),
  ]);
  if (!byId.allowed || !byIp.allowed) {
    return tooManyAttempts(Math.max(byId.retryAfterSeconds, byIp.retryAfterSeconds));
  }

  try {
    const result = await identity.authentication.login({ email: identifier, password: body.password });
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    res.headers.set('set-cookie', sessionCookie(context, result.sessionToken));
    return res;
  } catch {
    // Credential failures are uniformly 401 with a safe message — never leak vendor/raw text.
    return jsonResponse({ error: 'Invalid credentials' }, 401);
  }
}
