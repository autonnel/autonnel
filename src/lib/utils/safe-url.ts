
export class UnsafeUrlError extends Error {
  code = 'UNSAFE_URL' as const;
  constructor(reason: string) {
    super(`Unsafe URL rejected: ${reason}`);
    this.name = 'UnsafeUrlError';
  }
}

export class ResponseTooLargeError extends Error {
  code = 'RESPONSE_TOO_LARGE' as const;
  constructor(limit: number) {
    super(`Response exceeded ${limit} bytes`);
    this.name = 'ResponseTooLargeError';
  }
}

export interface SafeUrlOptions {
  schemes?: ReadonlyArray<'http:' | 'https:'>;
  maxRedirects?: number;
}

export interface SafeFetchOptions extends SafeUrlOptions {
  timeoutMs?: number;
  maxBytes?: number;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_SCHEMES: ReadonlyArray<'http:' | 'https:'> = ['https:'];

let _dnsLookup: ((host: string) => Promise<{ address: string; family: number }[]>) | null = null;
let _dnsProbed = false;

async function getDnsLookup() {
  if (_dnsProbed) return _dnsLookup;
  _dnsProbed = true;
  try {
    const mod = await import( 'node:' + 'dns/promises');
    if (typeof mod.lookup === 'function') {
      _dnsLookup = async (host: string) => {
        const all = await mod.lookup(host, { all: true });
        return all.map((r: { address: string; family: number }) => ({
          address: r.address,
          family: r.family,
        }));
      };
    }
  } catch {
  }
  return _dnsLookup;
}

function isIpV4Private(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a >= 224 && a <= 239) return true;
  if (a >= 240) return true;
  return false;
}

function isIpV6Private(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  const v4MappedDotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4MappedDotted) return isIpV4Private(v4MappedDotted[1]);
  const v4MappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4MappedHex) {
    const hi = parseInt(v4MappedHex[1], 16);
    const lo = parseInt(v4MappedHex[2], 16);
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isIpV4Private(ipv4);
  }
  return false;
}

function isLiteralIp(host: string): { ip: string; family: 4 | 6 } | null {
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare)) {
    return { ip: bare, family: 4 };
  }
  if (bare.includes(':')) {
    return { ip: bare, family: 6 };
  }
  return null;
}

function isPrivateIp(ip: string, family: 4 | 6): boolean {
  return family === 4 ? isIpV4Private(ip) : isIpV6Private(ip);
}

export async function assertSafeUrl(rawUrl: string, opts: SafeUrlOptions = {}): Promise<URL> {
  const schemes = opts.schemes ?? DEFAULT_SCHEMES;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('malformed URL');
  }
  if (!schemes.includes(parsed.protocol as 'http:' | 'https:')) {
    throw new UnsafeUrlError(`scheme ${parsed.protocol} not allowed`);
  }

  const host = parsed.hostname;
  if (!host) throw new UnsafeUrlError('empty hostname');

  const lowerHost = host.toLowerCase();
  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local') ||
    lowerHost.endsWith('.internal') ||
    lowerHost === 'metadata.google.internal'
  ) {
    throw new UnsafeUrlError(`reserved hostname ${host}`);
  }

  const literal = isLiteralIp(host);
  if (literal && isPrivateIp(literal.ip, literal.family)) {
    throw new UnsafeUrlError(`literal private IP ${literal.ip}`);
  }

  const lookup = await getDnsLookup();
  if (lookup && !literal) {
    let records: { address: string; family: number }[];
    try {
      records = await lookup(host);
    } catch (err) {
      throw new UnsafeUrlError(`DNS lookup failed for ${host}`);
    }
    if (records.length === 0) {
      throw new UnsafeUrlError(`no DNS records for ${host}`);
    }
    for (const r of records) {
      const fam = r.family === 6 ? 6 : 4;
      if (isPrivateIp(r.address, fam)) {
        throw new UnsafeUrlError(`${host} resolved to private IP ${r.address}`);
      }
    }
  }

  return parsed;
}

export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  let current = url;
  let hops = 0;
  while (true) {
    await assertSafeUrl(current, opts);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, {
        method: opts.method ?? 'GET',
        headers: opts.headers,
        body: opts.body,
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return res;
      if (hops >= maxRedirects) {
        throw new UnsafeUrlError(`exceeded ${maxRedirects} redirects`);
      }
      hops++;
      current = new URL(location, current).href;
      continue;
    }

    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new ResponseTooLargeError(maxBytes);
    }

    return capResponseBody(res, maxBytes);
  }
}

function capResponseBody(res: Response, maxBytes: number): Response {
  if (!res.body) return res;
  let total = 0;
  const reader = res.body.getReader();
  const limited = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        controller.error(new ResponseTooLargeError(maxBytes));
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      reader.cancel(reason);
    },
  });
  return new Response(limited, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
