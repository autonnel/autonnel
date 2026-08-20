// SSRF defence: the global fetch resolves the hostname itself, so a validated DNS answer can be
// swapped for a private address before the connection opens (DNS rebinding). This module connects
// to an address the caller already validated, while leaving the hostname in place for TLS SNI and
// the Host header so certificate validation and virtual hosting still work.
//
// Node-only. `node:` specifiers are assembled at runtime so workerd's eager module-graph check
// does not fail the build, and `getPinnedFetch()` returns null on workerd so callers take their
// own non-pinned path. Note nodejs_compat makes the imports themselves succeed on workerd, so the
// runtime is ruled out explicitly rather than inferred from whether the modules load.

import { isCloudflareRuntime } from '@/lib/runtime/env';

export interface PinnedFetchInit {
  pinnedAddress: string;
  family: 4 | 6;
  method?: string;
  headers?: HeadersInit;
  body?: string | Uint8Array;
  signal?: AbortSignal;
}

export type PinnedFetch = (url: string, init: PinnedFetchInit) => Promise<Response>;

interface NodeClientRequest {
  on(event: string, cb: (arg: unknown) => void): unknown;
  end(body?: string | Uint8Array): void;
  destroy(err?: Error): void;
}

interface NodeRequestModule {
  request(url: string, options: Record<string, unknown>): NodeClientRequest;
}

let probed = false;
let impl: PinnedFetch | null = null;

function headersToObject(init?: HeadersInit): Record<string, string> {
  if (!init) return {};
  const out: Record<string, string> = {};
  new Headers(init).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function loadModules(): Promise<
  { http: NodeRequestModule; https: NodeRequestModule; toWeb: (s: unknown) => unknown } | null
> {
  // workerd's nodejs_compat DOES provide node:http/https, so importing them succeeds there and the
  // probe below cannot tell the runtimes apart. But its ClientRequest rejects `options.lookup`,
  // which is the whole point of this module, and it throws only once a request is dispatched -
  // every safeFetch caller on Workers then fails at runtime. Rule the runtime out up front.
  if (isCloudflareRuntime()) return null;
  try {
    const http = (await import('node:' + 'http')) as unknown as NodeRequestModule;
    const https = (await import('node:' + 'https')) as unknown as NodeRequestModule;
    const stream = (await import('node:' + 'stream')) as unknown as {
      Readable: { toWeb(s: unknown): unknown };
    };
    if (typeof http.request !== 'function' || typeof https.request !== 'function') return null;
    if (typeof stream?.Readable?.toWeb !== 'function') return null;
    return { http, https, toWeb: (s) => stream.Readable.toWeb(s) };
  } catch {
    return null;
  }
}

export async function getPinnedFetch(): Promise<PinnedFetch | null> {
  if (probed) return impl;
  probed = true;
  const mods = await loadModules();
  if (!mods) return impl;

  impl = (url, init) =>
    new Promise<Response>((resolve, reject) => {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? mods.https : mods.http;

      // net.connect calls lookup(hostname, options, callback). With `all` set it wants an array;
      // both shapes are answered with the single pinned address and nothing else.
      const lookup = (
        _hostname: string,
        options: { all?: boolean },
        cb: (err: Error | null, address: unknown, family?: number) => void,
      ): void => {
        if (options?.all) {
          cb(null, [{ address: init.pinnedAddress, family: init.family }]);
          return;
        }
        cb(null, init.pinnedAddress, init.family);
      };

      let settled = false;
      // servername defaults to the URL hostname, so TLS SNI + cert validation stay on the real
      // name even though the socket connects to the pinned IP.
      const req = mod.request(url, {
        method: init.method ?? 'GET',
        headers: headersToObject(init.headers),
        lookup,
      });

      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        req.destroy(new Error('The operation was aborted'));
        reject(new DOMException('The operation was aborted', 'AbortError'));
      };
      if (init.signal) {
        if (init.signal.aborted) {
          onAbort();
          return;
        }
        init.signal.addEventListener('abort', onAbort, { once: true });
      }

      req.on('response', (raw: unknown) => {
        if (settled) return;
        settled = true;
        const res = raw as {
          statusCode?: number;
          statusMessage?: string;
          headers: Record<string, string | string[] | undefined>;
        };
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (value === undefined) continue;
          for (const v of Array.isArray(value) ? value : [value]) headers.append(key, v);
        }
        const status = res.statusCode ?? 502;
        // 204/304 must not carry a body stream.
        const body = status === 204 || status === 304 ? null : (mods.toWeb(raw) as ReadableStream);
        resolve(new Response(body, { status, statusText: res.statusMessage ?? '', headers }));
      });

      req.on('error', (err: unknown) => {
        if (settled) return;
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      req.end(init.body);
    });

  return impl;
}
