import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertSafeUrl, safeFetch, UnsafeUrlError, ResponseTooLargeError } from '../safe-url';

describe('assertSafeUrl — literal IP rejection', () => {
  it.each([
    'http://127.0.0.1/',
    'http://127.255.255.254:8080/',
    'http://0.0.0.0/',
    'http://10.0.0.1/',
    'http://172.16.0.1/',
    'http://172.31.255.254/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1/',
    'http://224.0.0.1/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
  ])('rejects %s', async (url) => {
    await expect(assertSafeUrl(url, { schemes: ['http:', 'https:'] })).rejects.toThrow(UnsafeUrlError);
  });
});

describe('assertSafeUrl — reserved hostnames', () => {
  it.each([
    'http://localhost/',
    'http://my.localhost/',
    'http://server.local/',
    'http://service.internal/',
    'http://metadata.google.internal/computeMetadata/v1/',
  ])('rejects %s', async (url) => {
    await expect(assertSafeUrl(url, { schemes: ['http:', 'https:'] })).rejects.toThrow(UnsafeUrlError);
  });
});

describe('assertSafeUrl — scheme enforcement', () => {
  it('rejects file://', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError);
  });
  it('rejects gopher://', async () => {
    await expect(assertSafeUrl('gopher://example.com/')).rejects.toThrow(UnsafeUrlError);
  });
  it('rejects http when default (https only)', async () => {
    await expect(assertSafeUrl('http://example.com/')).rejects.toThrow(UnsafeUrlError);
  });
  it('accepts http when explicitly allowed (and host resolves public)', async () => {
    await expect(
      assertSafeUrl('http://example.com/', { schemes: ['http:', 'https:'] }),
    ).resolves.toBeInstanceOf(URL);
  });
});

describe('assertSafeUrl — malformed input', () => {
  it('rejects empty', async () => {
    await expect(assertSafeUrl('')).rejects.toThrow(UnsafeUrlError);
  });
  it('rejects garbage', async () => {
    await expect(assertSafeUrl('not a url')).rejects.toThrow(UnsafeUrlError);
  });
});

describe('safeFetch — redirect validation', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects a redirect that points at a private IP', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push(url);
      if (url === 'https://example.com/redirect') {
        return new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        });
      }
      return new Response('should not be reached', { status: 200 });
    }) as any;

    await expect(
      safeFetch('https://example.com/redirect', { schemes: ['http:', 'https:'] }),
    ).rejects.toThrow(UnsafeUrlError);
    expect(calls).toEqual(['https://example.com/redirect']);
  });

  it('caps response body via maxBytes (declared content-length)', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('ok', {
        status: 200,
        headers: { 'content-length': '99999999' },
      });
    }) as any;

    await expect(
      safeFetch('https://example.com/big', { schemes: ['http:', 'https:'], maxBytes: 1024 }),
    ).rejects.toThrow(ResponseTooLargeError);
  });
});
