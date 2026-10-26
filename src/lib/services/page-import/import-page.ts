

import * as cheerio from 'cheerio';
import { createLogger } from '@/lib/logger';
import type { SiteS3Config } from '@/lib/s3';
import type { SiteUploadContext } from '@/lib/services/site-upload';
import { safeFetch, UnsafeUrlError } from '@/lib/utils/safe-url';
import { fetchRenderedHtml } from './cf-browser-rendering';
import { isCloudflareChallenge } from './cloudflare-detector';
import { migrateAssets } from './asset-migrator';
import { BrowserRenderingNotConfiguredError, CloudflareChallengeError } from './errors';

const logger = createLogger('PageImport');

export type ImportTier = 'fetch' | 'browser-rendering';

export interface ImportPageOpts {
  url: string;
  pageId: string;
  uploadCtx: SiteUploadContext;
  s3Config: SiteS3Config;
}

export interface ImportPageResult {
  html: string;
  migrated: number;
  tier: ImportTier;
}

const MIN_SERVER_RENDERED_TEXT = 200;

async function plainFetchHtml(url: string): Promise<string> {
  const res = await safeFetch(url, {
    schemes: ['http:', 'https:'],
    maxBytes: 20 * 1024 * 1024,
    timeoutMs: 30_000,
  });
  if (!res.ok) {
    throw new Error(`Source returned HTTP ${res.status}`);
  }
  return res.text();
}

function hasServerRenderedContent(html: string): boolean {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().length >= MIN_SERVER_RENDERED_TEXT;
}

// A rendered DOM has already been mutated by the page's own scripts, which the clone runs
// again: guarded widgets see their "already initialised" markers and never start, unguarded
// ones duplicate themselves. Only client-rendered shells need the browser.
async function captureHtml(url: string): Promise<{ html: string; tier: ImportTier }> {
  let plain: string | null = null;
  let plainError: unknown;
  try {
    plain = await plainFetchHtml(url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    plainError = err;
    logger.info('Plain fetch failed, using Browser Rendering', { url, error: err });
  }
  if (plain && !isCloudflareChallenge(plain) && hasServerRenderedContent(plain)) {
    return { html: plain, tier: 'fetch' };
  }

  try {
    const html = await fetchRenderedHtml(url);
    return { html, tier: 'browser-rendering' };
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    if (plain !== null) {
      logger.warn('Browser Rendering unavailable, keeping fetched html', { url, error: err });
      return { html: plain, tier: 'fetch' };
    }
    throw err instanceof BrowserRenderingNotConfiguredError ? plainError : err;
  }
}

export async function importPage(opts: ImportPageOpts): Promise<ImportPageResult> {
  const { html: captured, tier } = await captureHtml(opts.url);
  logger.info('Page captured', { url: opts.url, tier, bytes: captured.length });

  if (isCloudflareChallenge(captured)) {
    throw new CloudflareChallengeError();
  }

  const baseFolder = `pages/${opts.pageId}/imported`;
  const { html, migrated } = await migrateAssets(captured, opts.url, {
    baseFolder,
    uploadCtx: opts.uploadCtx,
    s3Config: opts.s3Config,
  });

  return { html, migrated, tier };
}
