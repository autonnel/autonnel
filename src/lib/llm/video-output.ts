import { Buffer } from 'node:buffer';
import {
  StorageNotConfiguredError,
  buildStaticUrl,
  uploadBase64Image,
  uploadFromUrl,
  uploadToS3,
} from '@/lib/s3';
import { getStorageContext } from '@/lib/config/storage';
import type { VideoJob } from './types';

const FOLDER_ROOT = 'ai-generated';

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('quicktime') || mimeType.includes('mov')) return 'mov';
  return 'mp4';
}

function folderFor(userId: string | undefined): string {
  return userId ? `${FOLDER_ROOT}/${userId}` : FOLDER_ROOT;
}

export async function normalizeVideoToS3Url(
  job: VideoJob,
  userId: string | undefined,
): Promise<string> {
  const { s3Config, staticDomain, primaryDomain } = await getStorageContext();
  if (!s3Config) throw new StorageNotConfiguredError();

  const folder = folderFor(userId);
  let key: string;

  if (job.outputBytes) {
    const buffer = Buffer.from(job.outputBytes.data, 'base64');
    const ext = extensionForMime(job.outputBytes.mimeType);
    key = await uploadToS3(buffer, `video.${ext}`, job.outputBytes.mimeType, folder, s3Config);
  } else if (job.outputUrl) {
    key = await uploadFromUrl(job.outputUrl, folder, s3Config);
  } else {
    throw new Error('Video job has no output');
  }

  return buildStaticUrl(key, staticDomain, primaryDomain);
}

export async function ensureImageUrl(
  image: string,
  userId: string | undefined,
): Promise<string> {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  if (!/^data:(image\/[a-z+\-.]+);base64,/i.test(image)) {
    throw new Error('Unsupported image format: must be URL or data URL');
  }
  const { s3Config, staticDomain, primaryDomain } = await getStorageContext();
  if (!s3Config) throw new StorageNotConfiguredError();
  const folder = folderFor(userId);
  const key = await uploadBase64Image(image, folder, s3Config);
  return buildStaticUrl(key, staticDomain, primaryDomain);
}
