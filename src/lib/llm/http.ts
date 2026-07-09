import { ProviderHttpError, ProviderTimeoutError } from './errors';

export interface FetchWithRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// Workers' fetch sends no default User-Agent; some provider gateways reject a
// missing/empty UA (e.g. DashScope's coding endpoint returns 405). Ensure one.
const DEFAULT_USER_AGENT = 'autonnel/1.0';

function jitter(maxMs: number): number {
  return Math.floor(Math.random() * maxMs);
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

async function readBodyExcerpt(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  } catch {
    return '';
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const timeoutMs = options.timeoutMs ?? 60_000;

  const headers = new Headers(init.headers);
  if (!headers.has('user-agent')) headers.set('user-agent', DEFAULT_USER_AGENT);
  const requestInit: RequestInit = { ...init, headers };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutCtl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtl.abort('timeout'), timeoutMs);
    const onExternalAbort = () => {
      clearTimeout(timeoutId);
      timeoutCtl.abort(options.abortSignal?.reason ?? new DOMException('aborted', 'AbortError'));
    };
    options.abortSignal?.addEventListener('abort', onExternalAbort, { once: true });

    let res: Response;
    try {
      res = await fetch(url, { ...requestInit, signal: timeoutCtl.signal });
    } catch (err) {
      clearTimeout(timeoutId);
      options.abortSignal?.removeEventListener('abort', onExternalAbort);
      if (options.abortSignal?.aborted) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ProviderTimeoutError(timeoutMs);
      }
      throw err;
    }
    clearTimeout(timeoutId);
    options.abortSignal?.removeEventListener('abort', onExternalAbort);

    if (res.ok) return res;

    if (!RETRYABLE_STATUS.has(res.status) || attempt === maxRetries) {
      throw new ProviderHttpError(res.status, await readBodyExcerpt(res));
    }

    const delay = baseDelayMs * 2 ** attempt + jitter(250);
    await sleep(delay, options.abortSignal);
  }

  throw new ProviderHttpError(0, 'fetchWithRetry exited without response');
}
