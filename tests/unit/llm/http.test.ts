import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithRetry } from '@/lib/llm/http';
import { ProviderHttpError, ProviderTimeoutError } from '@/lib/llm/errors';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function ok(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}
function err(status: number, body = ''): Response {
  return new Response(body, { status });
}

describe('fetchWithRetry', () => {
  it('returns 2xx response immediately', async () => {
    fetchMock.mockResolvedValueOnce(ok({ hello: 'world' }));
    const res = await fetchWithRetry('https://x.example', {}, { baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(err(429, 'rate limited'))
      .mockResolvedValueOnce(ok());
    const res = await fetchWithRetry('https://x.example', {}, { baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(err(503))
      .mockResolvedValueOnce(err(502))
      .mockResolvedValueOnce(ok());
    const res = await fetchWithRetry('https://x.example', {}, { baseDelayMs: 1, maxRetries: 3 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws ProviderHttpError after max retries on persistent 5xx', async () => {
    fetchMock.mockResolvedValue(err(502, 'bad gateway'));
    await expect(
      fetchWithRetry('https://x.example', {}, { baseDelayMs: 1, maxRetries: 2 }),
    ).rejects.toBeInstanceOf(ProviderHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws ProviderHttpError immediately on non-retryable 4xx', async () => {
    fetchMock.mockResolvedValueOnce(err(401, 'bad key'));
    await expect(
      fetchWithRetry('https://x.example', {}, { baseDelayMs: 1 }),
    ).rejects.toMatchObject({ code: 'PROVIDER_HTTP_ERROR', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ProviderTimeoutError when fetch hangs past timeoutMs', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    await expect(
      fetchWithRetry('https://x.example', {}, { baseDelayMs: 1, timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it('cascades external abortSignal cancellation', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const p = fetchWithRetry('https://x.example', {}, {
      baseDelayMs: 1,
      timeoutMs: 5000,
      abortSignal: controller.signal,
    });
    queueMicrotask(() => controller.abort());
    await expect(p).rejects.toBeInstanceOf(DOMException);
  });
});
