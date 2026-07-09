// Trust order: Cloudflare's cf-connecting-ip (set by the edge, not spoofable behind CF),
// then the first hop of x-forwarded-for, then x-real-ip. Returns 'unknown' so callers
// always have a non-empty rate-limit key (one shared bucket for un-attributable traffic).
export function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }

  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();

  return 'unknown';
}
