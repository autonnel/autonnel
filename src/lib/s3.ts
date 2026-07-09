import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';
import { createLogger } from '@/lib/logger';
import { EdgeS3Client } from '@/lib/adapters/storage/s3';
import { safeFetch } from '@/lib/utils/safe-url';

const logger = createLogger('S3');

const CACHE_CONTROL = 'public, max-age=31536000';

export interface SiteS3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix?: string;
}

export class StorageNotConfiguredError extends Error {
  code = 'STORAGE_NOT_CONFIGURED' as const;
  constructor() {
    super('Storage is not configured. Configure it in Settings → Storage.');
    this.name = 'StorageNotConfiguredError';
  }
}

function isValidConfig(config: SiteS3Config | null | undefined): config is SiteS3Config {
  return Boolean(
    config &&
      config.endpoint &&
      config.bucket &&
      config.accessKeyId &&
      config.secretAccessKey,
  );
}

export function createS3ClientFromConfig(
  config: SiteS3Config | null | undefined,
): { client: EdgeS3Client; bucket: string } {
  if (!isValidConfig(config)) {
    throw new StorageNotConfiguredError();
  }
  const client = new EdgeS3Client({
    endpoint: config.endpoint,
    region: config.region || 'auto',
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    keyPrefix: config.keyPrefix ?? '',
  });
  return { client, bucket: config.bucket };
}

export async function verifyS3Connection(
  config: SiteS3Config | null | undefined,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { client } = createS3ClientFromConfig(config);
    const key = `.autonnel-verify-${Date.now()}`;
    await client.putObject(key, new Uint8Array([0]), 'text/plain');
    await client.deleteObject(key);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    return { success: false, error: message || 'Unknown error' };
  }
}

export async function listObjectsByPrefix(
  prefix: string,
  config: SiteS3Config | null | undefined,
): Promise<{ key: string; size: number }[]> {
  const { client } = createS3ClientFromConfig(config);
  return client.listObjects(prefix);
}

export async function migrateS3Objects(
  prefix: string,
  sourceConfig: SiteS3Config | null | undefined,
  targetConfig: SiteS3Config | null | undefined,
  onProgress?: (completed: number, total: number, key: string) => void,
  concurrency = 10,
): Promise<{ migrated: number; failed: number; errors: string[] }> {
  const objects = await listObjectsByPrefix(prefix, sourceConfig);
  const srcClient = createS3ClientFromConfig(sourceConfig).client;
  const targetClient = createS3ClientFromConfig(targetConfig).client;

  const limit = pLimit(concurrency);
  let migrated = 0;
  let failed = 0;
  let completed = 0;
  const errors: string[] = [];

  const tasks = objects.map((obj) =>
    limit(async () => {
      try {
        const { body, contentType } = await srcClient.getObject(obj.key);
        await targetClient.putObject(obj.key, body, contentType);
        migrated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        errors.push(`Failed to migrate ${obj.key}: ${message || 'Unknown error'}`);
        failed++;
      } finally {
        completed++;
        onProgress?.(completed, objects.length, obj.key);
      }
    }),
  );

  await Promise.all(tasks);
  return { migrated, failed, errors };
}

export function maskSecretKey(secret: string | null | undefined): string {
  if (!secret || secret.length <= 8) return '********';
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}

export async function uploadToS3(
  file: ArrayBuffer | Uint8Array | string,
  fileName: string,
  contentType: string,
  folder = 'uploads',
  siteS3Config: SiteS3Config | null | undefined,
): Promise<string> {
  const { client } = createS3ClientFromConfig(siteS3Config);
  const ext = fileName.split('.').pop() || 'bin';
  const key = `${folder}/${uuidv4()}.${ext}`;
  await client.putObject(key, file, contentType, CACHE_CONTROL);
  return key;
}

export async function uploadToS3WithKey(
  file: ArrayBuffer | Uint8Array | string,
  key: string,
  contentType: string,
  siteS3Config: SiteS3Config | null | undefined,
): Promise<string> {
  const { client } = createS3ClientFromConfig(siteS3Config);
  await client.putObject(key, file, contentType, CACHE_CONTROL);
  return key;
}

interface UploadFromUrlOptions {
  maxBytes?: number;
  timeoutMs?: number;
  allowedContentTypes?: string[];
}

const URL_CONTENT_TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export async function uploadFromUrl(
  url: string,
  folder = 'media',
  siteS3Config: SiteS3Config | null | undefined,
  opts: UploadFromUrlOptions = {},
): Promise<string> {
  if (!isValidConfig(siteS3Config)) {
    throw new StorageNotConfiguredError();
  }

  const resp = await safeFetch(url, {
    schemes: ['http:', 'https:'],
    maxBytes: opts.maxBytes ?? 50 * 1024 * 1024,
    timeoutMs: opts.timeoutMs ?? 30_000,
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
  }

  const buffer = await resp.arrayBuffer();
  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase();

  if (opts.allowedContentTypes && !opts.allowedContentTypes.includes(normalized)) {
    throw new Error(`Downloaded content type not allowed: ${normalized}`);
  }

  let ext: string;
  if (URL_CONTENT_TYPE_EXT[normalized]) {
    ext = URL_CONTENT_TYPE_EXT[normalized];
  } else if (url.includes('.')) {
    ext = url.split('.').pop()?.split('?')[0] || 'bin';
  } else {
    ext = 'bin';
  }

  const key = `${folder}/${uuidv4()}.${ext}`;
  const { client } = createS3ClientFromConfig(siteS3Config);
  try {
    await client.putObject(key, new Uint8Array(buffer), contentType, CACHE_CONTROL);
  } catch (err) {
    logger.error('uploadFromUrl putObject failed', { error: err instanceof Error ? err : new Error(String(err)), url, key });
    throw err;
  }
  return key;
}

export async function uploadBase64Image(
  base64Data: string,
  folder = 'uploads',
  siteS3Config: SiteS3Config | null | undefined,
): Promise<string> {
  const allowed = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);
  const maxBytes = 10 * 1024 * 1024;

  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image data');
  }

  const contentType = matches[1].toLowerCase();
  if (!allowed.has(contentType)) {
    throw new Error(`Base64 image type not allowed: ${contentType}`);
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > maxBytes) {
    throw new Error('Base64 image too large');
  }

  let ext: string;
  if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
  else if (contentType.includes('png')) ext = 'png';
  else if (contentType.includes('webp')) ext = 'webp';
  else if (contentType.includes('gif')) ext = 'gif';
  else ext = 'bin';

  return uploadToS3(buffer, `image.${ext}`, contentType, folder, siteS3Config);
}

export function getRootDomain(domain: string): string {
  const parts = domain.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : domain;
}

export function getSiteStaticUrl(
  staticSubdomain: string | null | undefined,
  primaryDomain: string | null | undefined,
): string {
  if (!staticSubdomain) return '';
  if (staticSubdomain.includes('.') && !staticSubdomain.startsWith('http')) {
    return `https://${staticSubdomain}`;
  }
  if (staticSubdomain.startsWith('http://') || staticSubdomain.startsWith('https://')) {
    return staticSubdomain.replace(/\/$/, '');
  }
  if (primaryDomain) {
    return `https://${staticSubdomain}.${getRootDomain(primaryDomain)}`;
  }
  return '';
}

export function buildStaticUrl(
  key: string,
  staticSubdomain: string | null | undefined,
  primaryDomain: string | null | undefined,
): string {
  const base = getSiteStaticUrl(staticSubdomain, primaryDomain);
  return base ? `${base}/${key}` : `/${key}`;
}

export function isS3Key(urlOrKey: string): boolean {
  return !(
    urlOrKey.startsWith('http://') ||
    urlOrKey.startsWith('https://') ||
    urlOrKey.startsWith('/')
  );
}

export function extractS3Key(
  url: string,
  staticSubdomain: string | null | undefined,
  primaryDomain: string | null | undefined,
): string | null {
  const base = getSiteStaticUrl(staticSubdomain, primaryDomain);
  if (!base || !url.startsWith(base)) return null;
  return url.slice(base.length + 1);
}

const EMPTY_INDEX_HTML =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title></title></head><body></body></html>';

export async function checkIndexHtmlExists(
  config: SiteS3Config | null | undefined,
): Promise<boolean> {
  try {
    const { client } = createS3ClientFromConfig(config);
    return await client.headObject('index.html');
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) throw err;
    logger.error('checkIndexHtmlExists failed', {
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return false;
  }
}

export async function createEmptyIndexHtml(
  config: SiteS3Config | null | undefined,
): Promise<void> {
  const { client } = createS3ClientFromConfig(config);
  await client.putObject('index.html', EMPTY_INDEX_HTML, 'text/html');
}

export async function ensureIndexHtmlExists(
  config: SiteS3Config | null | undefined,
): Promise<boolean> {
  const exists = await checkIndexHtmlExists(config);
  if (!exists) {
    await createEmptyIndexHtml(config);
    return true;
  }
  return false;
}

export function getS3Client(config: SiteS3Config | null | undefined): EdgeS3Client {
  return createS3ClientFromConfig(config).client;
}

export function getBucketName(config: SiteS3Config | null | undefined): string {
  return createS3ClientFromConfig(config).bucket;
}
