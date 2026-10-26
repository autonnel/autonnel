import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { uploadFromUrl } from '@/lib/s3';
import { buildUrlFromContext, type SiteUploadContext } from '@/lib/services/site-upload';
import type { SiteS3Config } from '@/lib/s3';
import { createLogger } from '@/lib/logger';

const logger = createLogger('PageImport:AssetMigrator');

const MIGRATE_CONCURRENCY = 5;

const ASSET_ATTRIBUTES = [
  { tag: 'img', attr: 'src' },
  { tag: 'img', attr: 'srcset' },
  { tag: 'link[rel="stylesheet"]', attr: 'href' },
  { tag: 'link[rel="icon"]', attr: 'href' },
  { tag: 'link[rel="shortcut icon"]', attr: 'href' },
  { tag: 'link[rel="apple-touch-icon"]', attr: 'href' },
  { tag: 'script', attr: 'src' },
  { tag: 'video', attr: 'src' },
  { tag: 'video', attr: 'poster' },
  { tag: 'audio', attr: 'src' },
  { tag: 'source', attr: 'src' },
  { tag: 'source', attr: 'srcset' },
  { tag: 'object', attr: 'data' },
  { tag: 'embed', attr: 'src' },
];

const BACKGROUND_URL_REGEX = /url\(['"]?([^'")\s]+)['"]?\)/gi;
const CSS_URL_REGEX = /url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi;
const CSS_IMPORT_REGEX = /@import\s+(['"])([^'"]+)\1/gi;

function resolveUrl(base: string, relative: string): string {
  try {
    if (relative.startsWith('data:') || relative.startsWith('blob:')) return relative;
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

// A rehosted stylesheet moves away from its relative fonts and images, so they are pinned to the
// original host instead of being 404s on ours.
export function absolutizeCssUrls(css: string, cssUrl: string): string {
  const absolutize = (ref: string): string =>
    ref.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(ref) ? ref : resolveUrl(cssUrl, ref);
  return css
    .replace(CSS_URL_REGEX, (_m, quote: string, ref: string) => `url(${quote}${absolutize(ref.trim())}${quote})`)
    .replace(CSS_IMPORT_REGEX, (_m, quote: string, ref: string) => `@import ${quote}${absolutize(ref)}${quote}`);
}

export interface MigrateAssetsContext {
  baseFolder: string;
  uploadCtx: SiteUploadContext;
  s3Config: SiteS3Config;
}

export async function migrateAssets(
  html: string,
  sourceUrl: string,
  ctx: MigrateAssetsContext,
): Promise<{ html: string; migrated: number }> {
  const $ = cheerio.load(html);
  const replacements = new Map<string, string>();

  // Collect every absolute source URL first, then upload uniques with a bounded pool, then rewrite
  // synchronously off the resolved map. Uploading concurrently (instead of one-at-a-time over 50+
  // resources) cuts wall-time well under the Workers request timeout.
  const pending = new Set<string>();
  const collect = (rawUrl: string): void => {
    const absolute = resolveUrl(sourceUrl, rawUrl);
    if (absolute.startsWith('http')) pending.add(absolute);
  };

  const eachAttr = (cb: (rawUrl: string) => void): void => {
    for (const { tag, attr } of ASSET_ATTRIBUTES) {
      for (const el of $(tag).toArray()) {
        const value = $(el).attr(attr);
        if (!value) continue;
        if (attr === 'srcset') {
          for (const part of value.split(',')) {
            const [url] = part.trim().split(/\s+/, 2);
            if (url) cb(url);
          }
        } else {
          cb(value);
        }
      }
    }
    for (const el of $('[style]').toArray()) {
      const style = $(el).attr('style');
      if (!style) continue;
      for (const m of style.matchAll(BACKGROUND_URL_REGEX)) cb(m[1]);
    }
  };

  eachAttr(collect);

  const limit = pLimit(MIGRATE_CONCURRENCY);
  await Promise.all(
    [...pending].map((absolute) =>
      limit(async () => {
        try {
          const key = await uploadFromUrl(absolute, ctx.baseFolder, ctx.s3Config, {
            transformCss: (css) => absolutizeCssUrls(css, absolute),
          });
          replacements.set(absolute, buildUrlFromContext(key, ctx.uploadCtx));
        } catch (err) {
          logger.warn('Asset migration failed', { absolute, error: err });
        }
      }),
    ),
  );

  const rewritten = (rawUrl: string): string | null => {
    const absolute = resolveUrl(sourceUrl, rawUrl);
    return replacements.get(absolute) ?? null;
  };

  for (const { tag, attr } of ASSET_ATTRIBUTES) {
    for (const el of $(tag).toArray()) {
      const $el = $(el);
      const value = $el.attr(attr);
      if (!value) continue;
      if (attr === 'srcset') {
        const items = value.split(',').map((part) => {
          const trimmed = part.trim();
          const [url, descriptor] = trimmed.split(/\s+/, 2);
          const next = rewritten(url);
          return next ? (descriptor ? `${next} ${descriptor}` : next) : trimmed;
        });
        $el.attr(attr, items.join(', '));
      } else {
        const next = rewritten(value);
        if (!next) continue;
        $el.attr(attr, next);
        // SRI forces a CORS fetch, which our static host does not answer.
        if ($el.is('script, link')) $el.removeAttr('integrity').removeAttr('crossorigin');
      }
    }
  }

  for (const el of $('[style]').toArray()) {
    const $el = $(el);
    const style = $el.attr('style');
    if (!style) continue;
    let next = style;
    for (const m of style.matchAll(BACKGROUND_URL_REGEX)) {
      const rep = rewritten(m[1]);
      if (rep) next = next.replace(m[1], rep);
    }
    $el.attr('style', next);
  }

  return { html: $.html(), migrated: replacements.size };
}
