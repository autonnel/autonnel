import { Buffer } from 'node:buffer';
import {
  StorageNotConfiguredError,
  buildStaticUrl,
  uploadFromUrl,
  uploadToS3,
} from '@/lib/s3';
import { getStorageContext } from '@/lib/config/storage';
import type { ImageOutput } from './types';

const FOLDER_ROOT = 'ai-generated';

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'bin';
}

export async function normalizeToS3Url(
  output: ImageOutput,
  userId: string | undefined,
): Promise<string> {
  const { s3Config, staticDomain, primaryDomain } = await getStorageContext();
  if (!s3Config) {
    // Graceful fallback: when object storage isn't configured, serve the provider's
    // own hosted URL directly instead of hard-failing (base64 outputs still need storage).
    if (output.type === 'url') return output.url;
    throw new StorageNotConfiguredError();
  }

  const folder = userId ? `${FOLDER_ROOT}/${userId}` : FOLDER_ROOT;

  let key: string;
  if (output.type === 'base64') {
    const buffer = Buffer.from(output.data, 'base64');
    const ext = extensionForMime(output.mimeType);
    key = await uploadToS3(buffer, `image.${ext}`, output.mimeType, folder, s3Config);
  } else {
    key = await uploadFromUrl(output.url, folder, s3Config);
  }

  return buildStaticUrl(key, staticDomain, primaryDomain);
}
