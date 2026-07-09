

import { createLogger } from '@/lib/logger';
import type { SiteS3Config } from '@/lib/s3';
import type { SiteUploadContext } from '@/lib/services/site-upload';
import { safeFetch, UnsafeUrlError } from '@/lib/utils/safe-url';
import { fetchRenderedHtml } from './cf-browser-rendering';
import { isCloudflareChallenge } from './cloudflare-detector';
import { migrateAssets } from './asset-migrator';
import {
  BrowserRenderingHttpError,
  BrowserRenderingNotConfiguredError,
  CloudflareChallengeError,
} from './errors';

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

async function captureHtml(url: string): Promise<{ html: string; tier: ImportTier }> {
  try {
    const html = await fetchRenderedHtml(url);
    return { html, tier: 'browser-rendering' };
  } catch (err) {
    if (err instanceof BrowserRenderingNotConfiguredError) {
      logger.info('Browser Rendering not configured, falling back to fetch', { url });
      const html = await plainFetchHtml(url);
      return { html, tier: 'fetch' };
    }
    if (err instanceof BrowserRenderingHttpError) {
      throw err;
    }
    if (err instanceof UnsafeUrlError) {
      throw err;
    }
    logger.warn('Browser Rendering network failure, falling back to fetch', { url, error: err });
    const html = await plainFetchHtml(url);
    return { html, tier: 'fetch' };
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
