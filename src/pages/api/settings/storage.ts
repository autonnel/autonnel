import { v4 as uuidv4 } from 'uuid';
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getConfig, setConfig, deleteConfig } from '@/lib/config/get-config';
import { ConfigKeys } from '@/lib/config/keys';
import {
  createS3ClientFromConfig,
  getSiteStaticUrl,
  maskSecretKey,
  type SiteS3Config,
} from '@/lib/s3';
import { safeFetch } from '@/lib/utils/safe-url';
import type { StorageConfigWire } from '@/contracts/settings';

const STORAGE_KEY = 'storage.s3';

export const GET = defineRoute('GET /api/settings/storage', { feature: 'SETTINGS_STORAGE' }, async (): Promise<StorageConfigWire | null> => {
  const config = await getConfig<SiteS3Config>(STORAGE_KEY);
  if (!config) return null;
  return {
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey ? maskSecretKey(config.secretAccessKey) : '',
    keyPrefix: config.keyPrefix ?? '',
  };
});

export const PUT = defineRoute('PUT /api/settings/storage', { feature: 'SETTINGS_STORAGE' }, async ({ input }): Promise<StorageConfigWire> => {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'Invalid body');
  if (!input.endpoint || !input.bucket || !input.accessKeyId) {
    throw new ApiError(400, 'endpoint, bucket and accessKeyId are required');
  }

  let secretAccessKey = input.secretAccessKey || '';
  if (secretAccessKey.includes('****')) {
    const existing = await getConfig<SiteS3Config>(STORAGE_KEY);
    secretAccessKey = existing?.secretAccessKey || '';
  }
  if (!secretAccessKey) throw new ApiError(400, 'secretAccessKey is required');

  const keyPrefix = typeof input.keyPrefix === 'string' ? input.keyPrefix : '';

  const merged: SiteS3Config = {
    endpoint: input.endpoint,
    region: input.region || 'auto',
    bucket: input.bucket,
    accessKeyId: input.accessKeyId,
    secretAccessKey,
    keyPrefix,
  };

  const staticDomain =
    typeof input.staticDomain === 'string' && input.staticDomain.trim().length > 0
      ? input.staticDomain.trim()
      : null;

  const verify = await verifyStorage(merged, staticDomain);
  if (!verify.ok) throw new ApiError(400, verify.error);

  await setConfig(STORAGE_KEY, merged);
  if (staticDomain) {
    await setConfig(ConfigKeys.DEFAULT_CDN_URL.key, staticDomain);
  } else {
    await deleteConfig(ConfigKeys.DEFAULT_CDN_URL.key);
  }

  return {
    endpoint: merged.endpoint,
    region: merged.region,
    bucket: merged.bucket,
    accessKeyId: merged.accessKeyId,
    secretAccessKey: maskSecretKey(merged.secretAccessKey),
    keyPrefix: merged.keyPrefix ?? '',
    staticDomain,
    test: verify.detail,
  };
});

export const DELETE = defineRoute('DELETE /api/settings/storage', { feature: 'SETTINGS_STORAGE' }, async () => {
  await deleteConfig(STORAGE_KEY);
  return { success: true } as const;
});

type VerifyResult =
  | { ok: true; detail: { uploadedKey: string; fetched: boolean; url: string | null } }
  | { ok: false; error: string };

async function verifyStorage(config: SiteS3Config, staticDomain: string | null): Promise<VerifyResult> {
  const { client } = createS3ClientFromConfig(config);
  const expected = `autonnel-verify-${Date.now()}`;
  const key = `.autonnel-verify/${uuidv4()}.txt`;

  try {
    await client.putObject(key, new TextEncoder().encode(expected), 'text/plain', 'public, max-age=60');
  } catch (err) {
    return { ok: false, error: `S3 upload failed: ${err instanceof Error ? err.message : 'unknown error'}` };
  }

  let fetched = false;
  let url: string | null = null;
  if (staticDomain) {
    const baseUrl = getSiteStaticUrl(staticDomain, null);
    if (!baseUrl) {
      await client.deleteObject(key).catch(() => {});
      return { ok: false, error: 'staticDomain must be a fully-qualified hostname (e.g. static.example.com)' };
    }
    url = `${baseUrl}/${key}`;
    try {
      const res = await safeFetch(url, { method: 'GET', maxBytes: 1024, timeoutMs: 10_000 });
      if (!res.ok) {
        await client.deleteObject(key).catch(() => {});
        return { ok: false, error: `Static domain fetch failed: HTTP ${res.status} (${url})` };
      }
      const text = await res.text();
      if (text.trim() !== expected) {
        await client.deleteObject(key).catch(() => {});
        return {
          ok: false,
          error: `Static domain returned unexpected body — confirm the domain points at the bucket (${url})`,
        };
      }
      fetched = true;
    } catch (err) {
      await client.deleteObject(key).catch(() => {});
      return { ok: false, error: `Static domain fetch failed: ${err instanceof Error ? err.message : 'unknown error'}` };
    }
  }

  await client.deleteObject(key).catch(() => {});
  return { ok: true, detail: { uploadedKey: key, fetched, url } };
}
