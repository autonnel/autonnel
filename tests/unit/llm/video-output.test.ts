import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SiteS3Config } from '@/lib/s3';
import { StorageNotConfiguredError } from '@/lib/s3';

const { uploadToS3Mock, uploadFromUrlMock, uploadBase64ImageMock, getStorageContextMock } = vi.hoisted(() => ({
  uploadToS3Mock: vi.fn(),
  uploadFromUrlMock: vi.fn(),
  uploadBase64ImageMock: vi.fn(),
  getStorageContextMock: vi.fn(),
}));

vi.mock('@/lib/s3', async () => {
  const actual = await vi.importActual<typeof import('@/lib/s3')>('@/lib/s3');
  return {
    ...actual,
    uploadToS3: uploadToS3Mock,
    uploadFromUrl: uploadFromUrlMock,
    uploadBase64Image: uploadBase64ImageMock,
  };
});

vi.mock('@/lib/config/storage', () => ({
  getStorageContext: getStorageContextMock,
}));

import { normalizeVideoToS3Url, ensureImageUrl } from '@/lib/llm/video-output';

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
  uploadBase64ImageMock.mockReset();
  getStorageContextMock.mockReset();
});

describe('normalizeVideoToS3Url', () => {
  it('uploads outputBytes and returns a permanent URL', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadToS3Mock.mockResolvedValue('ai-generated/user-1/abc.mp4');
    const url = await normalizeVideoToS3Url(
      { id: 'j', status: 'succeeded', outputBytes: { data: 'aGVsbG8=', mimeType: 'video/mp4' } },
      'user-1',
    );
    expect(url).toBe('https://static.example.com/ai-generated/user-1/abc.mp4');
    const [bufferArg, fileNameArg, contentTypeArg, folderArg, configArg] = uploadToS3Mock.mock.calls[0];
    expect((bufferArg as Buffer).toString()).toBe('hello');
    expect(fileNameArg).toMatch(/\.mp4$/);
    expect(contentTypeArg).toBe('video/mp4');
    expect(folderArg).toBe('ai-generated/user-1');
    expect(configArg).toBe(S3_CONFIG);
  });

  it('uploads outputUrl by downloading and re-uploading', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadFromUrlMock.mockResolvedValue('ai-generated/user-1/xyz.mp4');
    const url = await normalizeVideoToS3Url(
      { id: 'j', status: 'succeeded', outputUrl: 'https://cdn.example/clip.mp4' },
      'user-1',
    );
    expect(url).toBe('https://static.example.com/ai-generated/user-1/xyz.mp4');
    expect(uploadFromUrlMock).toHaveBeenCalledWith(
      'https://cdn.example/clip.mp4',
      'ai-generated/user-1',
      S3_CONFIG,
    );
  });

  it('prefers outputBytes when both are set', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadToS3Mock.mockResolvedValue('ai-generated/abc.mp4');
    await normalizeVideoToS3Url(
      {
        id: 'j', status: 'succeeded',
        outputBytes: { data: 'aGk=', mimeType: 'video/mp4' },
        outputUrl: 'https://should-not-be-used',
      },
      undefined,
    );
    expect(uploadFromUrlMock).not.toHaveBeenCalled();
    expect(uploadToS3Mock).toHaveBeenCalled();
  });

  it('throws when both outputs are missing', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    await expect(
      normalizeVideoToS3Url({ id: 'j', status: 'succeeded' }, 'user-1'),
    ).rejects.toThrow(/no output/i);
  });

  it('throws StorageNotConfiguredError when s3Config null', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: null, staticDomain: null, primaryDomain: null,
    });
    await expect(
      normalizeVideoToS3Url(
        { id: 'j', status: 'succeeded', outputUrl: 'https://cdn/x.mp4' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('maps video/webm mime to .webm extension', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadToS3Mock.mockResolvedValue('ai-generated/x.webm');
    await normalizeVideoToS3Url(
      { id: 'j', status: 'succeeded', outputBytes: { data: 'AA==', mimeType: 'video/webm' } },
      undefined,
    );
    expect(uploadToS3Mock.mock.calls[0][1]).toMatch(/\.webm$/);
  });
});

describe('ensureImageUrl', () => {
  it('returns http URL as-is', async () => {
    const out = await ensureImageUrl('https://cdn/a.png', 'user-1');
    expect(out).toBe('https://cdn/a.png');
    expect(uploadBase64ImageMock).not.toHaveBeenCalled();
  });

  it('returns https URL as-is', async () => {
    const out = await ensureImageUrl('http://cdn/a.png', 'user-1');
    expect(out).toBe('http://cdn/a.png');
    expect(uploadBase64ImageMock).not.toHaveBeenCalled();
  });

  it('uploads data URL and returns CDN URL', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: S3_CONFIG,
      staticDomain: 'static.example.com',
      primaryDomain: 'example.com',
    });
    uploadBase64ImageMock.mockResolvedValue('ai-generated/user-1/img.png');
    const out = await ensureImageUrl(
      'data:image/png;base64,iVBORw0KG',
      'user-1',
    );
    expect(out).toBe('https://static.example.com/ai-generated/user-1/img.png');
    expect(uploadBase64ImageMock).toHaveBeenCalledWith(
      'data:image/png;base64,iVBORw0KG',
      'ai-generated/user-1',
      S3_CONFIG,
    );
  });

  it('throws on unsupported image format', async () => {
    await expect(ensureImageUrl('ftp://x/y', 'user-1')).rejects.toThrow(/unsupported image/i);
  });

  it('throws StorageNotConfiguredError when uploading data URL without s3', async () => {
    getStorageContextMock.mockResolvedValue({
      s3Config: null, staticDomain: null, primaryDomain: null,
    });
    await expect(
      ensureImageUrl('data:image/png;base64,AAAA', 'user-1'),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });
});
