

import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { uploadToS3WithKey, buildStaticUrl } from '@/lib/s3';
import { getStorageContext, requireS3Config } from '@/lib/config/storage';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { setBrandingFavicon, ConfigKeys } from '@/lib/config/keys';
import { deleteConfig } from '@/lib/config/get-config';
import type { FaviconJson, FaviconVariants } from '@/lib/branding/types';

const logger = createLogger('BrandingFaviconAPI');

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024;

const VARIANTS: { name: keyof FaviconVariants & string; size: number }[] = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
];

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

export const POST: APIRoute = withAuth(FEATURES.SETTINGS_BRANDING, async (ctx) => {
  const formData = await ctx.request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return jsonError('No file provided', 400);
  if (!ALLOWED.includes(file.type)) {
    return jsonError('Invalid file type. Allowed: png, jpeg, webp', 400);
  }
  if (file.size > MAX_SIZE) {
    return jsonError('File too large. Maximum size is 2MB', 400);
  }

  const tenantId = getCurrentTenantId();
  const s3Config = await requireS3Config();
  const storage = await getStorageContext();

  const arrayBuffer = await file.arrayBuffer();
  const sourceBuf = Buffer.from(arrayBuffer);
  const sourceExt = extFromMime(file.type);
  const sourceKey = `branding/${tenantId}/source-${uuidv4()}.${sourceExt}`;

  await uploadToS3WithKey(sourceBuf, sourceKey, file.type, s3Config);
  const sourceUrl = buildStaticUrl(sourceKey, storage.staticDomain, storage.primaryDomain);

  const variants: FaviconVariants = {};
  for (const v of VARIANTS) {
    try {
      const buf = await sharp(sourceBuf)
        .resize(v.size, v.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const key = `branding/${tenantId}/${v.name.replace('.png', '')}-${uuidv4()}.png`;
      await uploadToS3WithKey(buf, key, 'image/png', s3Config);
      variants[v.name] = buildStaticUrl(key, storage.staticDomain, storage.primaryDomain);
    } catch (err) {
      logger.error('Failed to generate favicon variant', { error: err, variant: v.name });
      return jsonError(`Failed to generate variant ${v.name}`, 500);
    }
  }

  const favicon: FaviconJson = { source: sourceUrl, variants };

  await setBrandingFavicon({ url: sourceUrl });

  return jsonResponse(favicon);
});

export const DELETE: APIRoute = withAuth(FEATURES.SETTINGS_BRANDING, async () => {
  await deleteConfig(ConfigKeys.BRANDING_FAVICON.key);
  return jsonResponse({ favicon: null });
});
