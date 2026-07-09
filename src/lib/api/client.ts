import type { ApiKey, ApiInput, ApiOutput } from '@/contracts';

export class ApiCallError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function apiCall<K extends ApiKey>(
  key: K,
  input: ApiInput<K>,
  opts?: { params?: Record<string, string | number>; query?: Record<string, string | number | undefined> },
): Promise<ApiOutput<K>> {
  const sp = key.indexOf(' ');
  const method = key.slice(0, sp);
  let path = key.slice(sp + 1);
  if (opts?.params) {
    for (const [k, v] of Object.entries(opts.params)) path = path.replace(`:${k}`, encodeURIComponent(String(v)));
  }
  if (opts?.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) if (v !== undefined) qs.set(k, String(v));
    const s = qs.toString();
    if (s) path += (path.includes('?') ? '&' : '?') + s;
  }
  const init: RequestInit = { method, headers: {} };
  if (method !== 'GET' && method !== 'DELETE' && input != null) {
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
    init.body = JSON.stringify(input);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiCallError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as ApiOutput<K>;
}
