import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRenderingNotConfiguredError } from './errors';

const safeFetch = vi.fn();
const fetchRenderedHtml = vi.fn();

vi.mock('@/lib/utils/safe-url', () => ({
  safeFetch: (...args: unknown[]) => safeFetch(...args),
  UnsafeUrlError: class UnsafeUrlError extends Error {},
}));
vi.mock('./cf-browser-rendering', () => ({
  fetchRenderedHtml: (...args: unknown[]) => fetchRenderedHtml(...args),
}));
vi.mock('./asset-migrator', () => ({
  migrateAssets: async (html: string) => ({ html, migrated: 0 }),
}));

import { importPage } from './import-page';

const opts = { url: 'https://src.test/p', pageId: 'p1', uploadCtx: {} as never, s3Config: {} as never };
const ok = (body: string) => ({ ok: true, status: 200, text: async () => body });

const SERVER_RENDERED = `<html><body><h1>Headline</h1><p>${'Real article copy. '.repeat(40)}</p>
<div id="popup"></div><script>if(!popup.dataset.bound){popup.dataset.bound='1'}</script></body></html>`;
const SPA_SHELL = `<html><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const RENDERED = `<html><body><div id="root"><h1>Rendered</h1></div></body></html>`;

describe('importPage capture tier', () => {
  beforeEach(() => {
    safeFetch.mockReset();
    fetchRenderedHtml.mockReset();
  });

  it('keeps server-rendered html so page scripts start from their initial DOM', async () => {
    safeFetch.mockResolvedValue(ok(SERVER_RENDERED));
    fetchRenderedHtml.mockResolvedValue('<html><body><div id="popup" data-bound="1"></div></body></html>');
    const res = await importPage(opts);
    expect(res.tier).toBe('fetch');
    expect(res.html).toBe(SERVER_RENDERED);
    expect(fetchRenderedHtml).not.toHaveBeenCalled();
  });

  it('renders a client-side shell in the browser', async () => {
    safeFetch.mockResolvedValue(ok(SPA_SHELL));
    fetchRenderedHtml.mockResolvedValue(RENDERED);
    const res = await importPage(opts);
    expect(res.tier).toBe('browser-rendering');
    expect(res.html).toBe(RENDERED);
  });

  it('renders when the plain fetch is refused', async () => {
    safeFetch.mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    fetchRenderedHtml.mockResolvedValue(RENDERED);
    expect((await importPage(opts)).tier).toBe('browser-rendering');
  });

  it('renders when the plain fetch hits a Cloudflare challenge', async () => {
    safeFetch.mockResolvedValue(ok('<html><head><title>Just a moment...</title></head><body></body></html>'));
    fetchRenderedHtml.mockResolvedValue(RENDERED);
    expect((await importPage(opts)).tier).toBe('browser-rendering');
  });

  it('falls back to the shell when rendering is not configured', async () => {
    safeFetch.mockResolvedValue(ok(SPA_SHELL));
    fetchRenderedHtml.mockRejectedValue(new BrowserRenderingNotConfiguredError());
    const res = await importPage(opts);
    expect(res.tier).toBe('fetch');
    expect(res.html).toBe(SPA_SHELL);
  });

  it('reports the fetch failure when rendering is not configured', async () => {
    safeFetch.mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    fetchRenderedHtml.mockRejectedValue(new BrowserRenderingNotConfiguredError());
    await expect(importPage(opts)).rejects.toThrow('Source returned HTTP 403');
  });
});
