import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SiteS3Config } from '@/lib/s3';
import { StorageNotConfiguredError } from '@/lib/s3';

const { uploadToS3Mock, uploadFromUrlMock, getStorageContextMock } = vi.hoisted(() => ({
  uploadToS3Mock: vi.fn(),
  uploadFromUrlMock: vi.fn(),
  getStorageContextMock: vi.fn(),
}));

vi.mock('@/lib/s3', async () => {
  const actual = await vi.importActual<typeof import('@/lib/s3')>('@/lib/s3');
  return {
    ...actual,
    uploadToS3: uploadToS3Mock,
    uploadFromUrl: uploadFromUrlMock,
  };
});

vi.mock('@/lib/config/storage', () => ({
  getStorageContext: getStorageContextMock,
}));

import { normalizeToS3Url } from '@/lib/llm/image-output';

const S3_CONFIG: SiteS3Config = {
  endpoint: 'https://s3.example',
  region: 'auto',
  bucket: 'autonnel',
  accessKeyId: 'k',
  secretAccessKey: 's',
};

beforeEach(() => {
  uploadToS3Mock.mockReset();
  uploadFromUrlMock.mockReset();
  getStorageContextMock.mockReset();
});

describe('normalizeToS3Url', () => {
  it('uploads base64 outputs and returns a permanent URL', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadToS3Mock.mockResolvedValue('ai-generated/user-1/abc.png');
    const url = await normalizeToS3Url(
      { type: 'base64', data: 'aGVsbG8=', mimeType: 'image/png' },
      'user-1',
    );
    expect(url).toBe('https://static.example.com/ai-generated/user-1/abc.png');
    const [bufferArg, fileNameArg, contentTypeArg, folderArg, configArg] = uploadToS3Mock.mock.calls[0];
    expect((bufferArg as Buffer).toString()).toBe('hello');
    expect(fileNameArg).toMatch(/\.png$/);
    expect(contentTypeArg).toBe('image/png');
    expect(folderArg).toBe('ai-generated/user-1');
    expect(configArg).toBe(S3_CONFIG);
  });

  it('uploads URL outputs by downloading and re-uploading', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadFromUrlMock.mockResolvedValue('ai-generated/user-1/xyz.jpg');
    const url = await normalizeToS3Url(
      { type: 'url', url: 'https://cdn.example/cat.jpg' },
      'user-1',
    );
    expect(url).toBe('https://static.example.com/ai-generated/user-1/xyz.jpg');
    expect(uploadFromUrlMock).toHaveBeenCalledWith(
      'https://cdn.example/cat.jpg',
      'ai-generated/user-1',
      S3_CONFIG,
    );
  });

  it('falls back to bare ai-generated folder when userId missing', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadToS3Mock.mockResolvedValue('ai-generated/abc.png');
    await normalizeToS3Url(
      { type: 'base64', data: 'aGVsbG8=', mimeType: 'image/png' },
      undefined,
    );
    expect(uploadToS3Mock.mock.calls[0][3]).toBe('ai-generated');
  });

  it('throws StorageNotConfiguredError when no s3 config present', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: null,
      staticDomain: null,
      primaryDomain: null,
    });
    await expect(
      normalizeToS3Url({ type: 'base64', data: 'aGVsbG8=', mimeType: 'image/png' }, 'user-1'),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('returns relative key path when staticDomain not configured', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: null,
      primaryDomain: null,
    });
    uploadToS3Mock.mockResolvedValue('ai-generated/abc.png');
    const url = await normalizeToS3Url(
      { type: 'base64', data: 'aGVsbG8=', mimeType: 'image/png' },
      undefined,
    );
    expect(url).toBe('/ai-generated/abc.png');
  });
});
