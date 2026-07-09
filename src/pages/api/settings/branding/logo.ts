import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { withAuth, jsonResponse, jsonError } from '@/lib/api-helpers';
import { FEATURES } from '@/lib/rbac';
import { uploadToS3WithKey, buildStaticUrl } from '@/lib/s3';
import { getStorageContext, requireS3Config } from '@/lib/config/storage';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { createLogger } from '@/lib/logger';
import { setBrandingLogo, ConfigKeys } from '@/lib/config/keys';
import { deleteConfig } from '@/lib/config/get-config';
import type { LogoJson } from '@/lib/branding/types';

const logger = createLogger('BrandingLogoAPI');

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const CONVERTIBLE = ['image/png', 'image/jpeg'];
const MAX_SIZE = 5 * 1024 * 1024;

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
    return jsonError('File too large. Maximum size is 5MB', 400);
  }

  const tenantId = getCurrentTenantId();
  const s3Config = await requireS3Config();
  const storage = await getStorageContext();

  const arrayBuffer = await file.arrayBuffer();
  const sourceBuf = Buffer.from(arrayBuffer);
  const sourceExt = extFromMime(file.type);
  const sourceKey = `branding/${tenantId}/logo-source-${uuidv4()}.${sourceExt}`;

  await uploadToS3WithKey(sourceBuf, sourceKey, file.type, s3Config);
  const sourceUrl = buildStaticUrl(sourceKey, storage.staticDomain, storage.primaryDomain);

  let finalBuf: Buffer = sourceBuf;
  let finalExt = sourceExt;
  let finalContentType = file.type;
  if (CONVERTIBLE.includes(file.type)) {
    try {
      finalBuf = (await sharp(sourceBuf).webp({ quality: 85 }).toBuffer()) as unknown as Buffer;
      finalExt = 'webp';
      finalContentType = 'image/webp';
    } catch (err) {
      logger.error('Failed to convert logo to webp; using original', { error: err });
    }
  }

  const finalKey = `branding/${tenantId}/logo-${uuidv4()}.${finalExt}`;
  await uploadToS3WithKey(finalBuf, finalKey, finalContentType, s3Config);
  const finalUrl = buildStaticUrl(finalKey, storage.staticDomain, storage.primaryDomain);

  const logo: LogoJson = { source: sourceUrl, url: finalUrl };

  await setBrandingLogo({ url: finalUrl });

  return jsonResponse(logo);
});

export const DELETE: APIRoute = withAuth(FEATURES.SETTINGS_BRANDING, async () => {
  await deleteConfig(ConfigKeys.BRANDING_LOGO.key);
  return jsonResponse({ logo: null });
});
