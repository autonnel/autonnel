import { readEnv, isCloudflareRuntime } from '@/lib/runtime/env';

type TrustMode = 'cloudflare' | 'forwarded' | 'none';

// Forwarding headers are client-controlled unless a proxy we trust overwrote them. Trusting them
// unconditionally lets a direct client rotate the apparent source on every request and slip past
// per-IP throttles. Default: trust cf-connecting-ip only on workerd (the edge always sets it);
// require explicit opt-in for x-forwarded-for; otherwise attribute nothing.
function trustMode(): TrustMode {
  const configured = readEnv('TRUSTED_PROXY');
  if (configured === 'cloudflare' || configured === 'forwarded' || configured === 'none') {
    return configured;
  }
  return isCloudflareRuntime() ? 'cloudflare' : 'none';
}

// Returns 'unknown' when the source cannot be attributed, so callers always have a non-empty key.
// That collapses un-attributable traffic into one shared bucket: it over-throttles rather than
// handing an attacker a fresh bucket per request.
export function getClientIp(request: Request): string {
  const mode = trustMode();
  if (mode === 'none') return 'unknown';

  if (mode === 'cloudflare') {
    const cf = request.headers.get('cf-connecting-ip');
    return cf ? cf.trim() : 'unknown';
  }

  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
