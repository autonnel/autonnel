
import { buildStaticUrl, getSiteStaticUrl, type SiteS3Config } from '@/lib/s3';
import {
  getStorageContext,
  getStorageContextByPage,
  type StorageContext,
} from '@/lib/config/storage';

export interface SiteUploadContext {
  s3Config: SiteS3Config | null;
  staticSubdomain: string | null;
  primaryDomain: string | null;
}

function toLegacy(ctx: StorageContext): SiteUploadContext {
  return {
    s3Config: ctx.s3Config,
    // name preserved on the public API to avoid churning callers.
    staticSubdomain: ctx.staticDomain,
    primaryDomain: ctx.primaryDomain,
  };
}

export async function getSiteUploadContext(_siteId?: string): Promise<SiteUploadContext | null> {
  const ctx = await getStorageContext();
  return toLegacy(ctx);
}

export async function getSiteUploadContextByPage(pageId: string): Promise<SiteUploadContext | null> {
  const ctx = await getStorageContextByPage(pageId);
  return ctx ? toLegacy(ctx) : null;
}

export function buildUrlFromContext(key: string, ctx: SiteUploadContext): string {
  return buildStaticUrl(key, ctx.staticSubdomain, ctx.primaryDomain);
}

export function getStaticUrlFromContext(ctx: SiteUploadContext): string {
  return getSiteStaticUrl(ctx.staticSubdomain, ctx.primaryDomain);
}
