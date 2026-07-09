import { safeFetch } from '@/lib/utils/safe-url';

const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const INPUT_IMAGE_TIMEOUT_MS = 15_000;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function fetchInputImageBytes(url: string): Promise<{
  buffer: ArrayBuffer;
  mimeType: string;
}> {
  const res = await safeFetch(url, {
    schemes: ['http:', 'https:'],
    maxBytes: MAX_INPUT_IMAGE_BYTES,
    timeoutMs: INPUT_IMAGE_TIMEOUT_MS,
  });
  if (!res.ok) throw new Error(`Failed to fetch input image: ${res.status}`);

  const mimeType = (res.headers.get('content-type') ?? 'image/png')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error(`Input image content type not allowed: ${mimeType}`);
  }

  return { buffer: await res.arrayBuffer(), mimeType };
}

export async function fetchInputImageBlob(url: string): Promise<Blob> {
  const { buffer, mimeType } = await fetchInputImageBytes(url);
  return new Blob([buffer], { type: mimeType });
}
