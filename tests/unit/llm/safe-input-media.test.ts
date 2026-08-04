import { describe, expect, it, vi, afterEach } from 'vitest';
import { UnsafeUrlError } from '@/lib/utils/safe-url';
import { fetchInputImageBytes } from '@/lib/llm/safe-input-media';

// safeFetch dispatches through the address-pinned Node client, not globalThis.fetch. These specs
// assert on a stubbed global fetch, so route the pinned dispatcher back to it. Pinning itself is
// covered by src/lib/utils/__tests__/pinned-fetch.test.ts.
vi.mock('@/lib/utils/pinned-fetch', () => ({
  getPinnedFetch: async () => (url: string, init: Record<string, unknown>) =>
    fetch(url, { ...init, redirect: 'manual' } as RequestInit),
}));


const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchInputImageBytes', () => {
  it('rejects private network image URLs before fetching', async () => {
    globalThis.fetch = vi.fn() as any;

    await expect(fetchInputImageBytes('http://127.0.0.1/image.png')).rejects.toThrow(UnsafeUrlError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects non-image content from otherwise safe URLs', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })) as any;

    await expect(fetchInputImageBytes('https://example.com/page')).rejects.toThrow(/content type not allowed/i);
  });
});
