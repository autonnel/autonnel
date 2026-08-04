import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { getPinnedFetch } from '../pinned-fetch';

let server: Server | null = null;

afterEach(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  server = null;
});

async function listen(handler: Parameters<typeof createServer>[1]): Promise<number> {
  server = createServer(handler);
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
  return (server!.address() as { port: number }).port;
}

describe('pinnedFetch', () => {
  it('connects to the pinned address and preserves the Host header', async () => {
    let seenHost = '';
    const port = await listen((req, res) => {
      seenHost = req.headers.host ?? '';
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    const fetchPinned = await getPinnedFetch();
    expect(fetchPinned).not.toBeNull();

    const res = await fetchPinned!(`http://example.test:${port}/x`, {
      pinnedAddress: '127.0.0.1',
      family: 4,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(seenHost).toBe(`example.test:${port}`);
  });

  it('returns redirects without following them', async () => {
    const port = await listen((_req, res) => {
      res.writeHead(302, { location: 'http://elsewhere.test/' });
      res.end();
    });
    const fetchPinned = await getPinnedFetch();
    const res = await fetchPinned!(`http://example.test:${port}/`, {
      pinnedAddress: '127.0.0.1',
      family: 4,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://elsewhere.test/');
  });

  it('sends the request body and method', async () => {
    let seen = { method: '', body: '' };
    const port = await listen((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen = { method: req.method ?? '', body };
        res.writeHead(204);
        res.end();
      });
    });
    const fetchPinned = await getPinnedFetch();
    const res = await fetchPinned!(`http://example.test:${port}/`, {
      pinnedAddress: '127.0.0.1',
      family: 4,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    expect(res.status).toBe(204);
    expect(seen.method).toBe('POST');
    expect(seen.body).toBe('{"a":1}');
  });

  it('aborts when the signal fires', async () => {
    const port = await listen(() => {
      /* never responds */
    });
    const fetchPinned = await getPinnedFetch();
    const controller = new AbortController();
    const promise = fetchPinned!(`http://example.test:${port}/`, {
      pinnedAddress: '127.0.0.1',
      family: 4,
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toThrow();
  });
});
