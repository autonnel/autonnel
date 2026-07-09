import { describe, it, expect, vi, beforeEach } from 'vitest';

const { putObjectMock } = vi.hoisted(() => ({
  putObjectMock: vi.fn(),
}));

vi.mock('@/lib/adapters/storage/s3', () => ({
  EdgeS3Client: vi.fn().mockImplementation(() => ({
    putObject: putObjectMock,
  })),
}));

import {
  uploadToS3,
  uploadToS3WithKey,
  uploadFromUrl,
  uploadBase64Image,
  createS3ClientFromConfig,
  StorageNotConfiguredError,
} from '@/lib/s3';

beforeEach(() => {
  vi.clearAllMocks();
  putObjectMock.mockResolvedValue(undefined);
});

describe('s3 no-env-fallback', () => {
  it('uploadToS3 throws StorageNotConfiguredError when config is null', async () => {
    await expect(
      uploadToS3(Buffer.from('x'), 'a.png', 'image/png', 'folder', null),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('uploadToS3WithKey throws StorageNotConfiguredError when config is null', async () => {
    await expect(
      uploadToS3WithKey(Buffer.from('x'), 'k', 'image/png', null),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('uploadFromUrl throws StorageNotConfiguredError when config is null', async () => {
    await expect(
      uploadFromUrl('https://example.com/x.png', 'folder', null),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('uploadBase64Image throws StorageNotConfiguredError when config is null', async () => {
    await expect(
      uploadBase64Image('data:image/png;base64,AAAA', 'folder', null),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('createS3ClientFromConfig throws when config is missing fields', () => {
    expect(() => createS3ClientFromConfig({
      endpoint: '',
      region: 'auto',
      bucket: 'b',
      accessKeyId: 'k',
      secretAccessKey: 's',
    })).toThrow(StorageNotConfiguredError);

    expect(() => createS3ClientFromConfig({
      endpoint: 'https://s3',
      region: 'auto',
      bucket: '',
      accessKeyId: 'k',
      secretAccessKey: 's',
    })).toThrow(StorageNotConfiguredError);

    expect(() => createS3ClientFromConfig({
      endpoint: 'https://s3',
      region: 'auto',
      bucket: 'b',
      accessKeyId: '',
      secretAccessKey: 's',
    })).toThrow(StorageNotConfiguredError);

    expect(() => createS3ClientFromConfig({
      endpoint: 'https://s3',
      region: 'auto',
      bucket: 'b',
      accessKeyId: 'k',
      secretAccessKey: '',
    })).toThrow(StorageNotConfiguredError);
  });

  it('uploadToS3 succeeds with a complete config', async () => {
    const cfg = {
      endpoint: 'https://s3.test',
      region: 'auto',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    };
    const key = await uploadToS3(Buffer.from('x'), 'a.png', 'image/png', 'folder', cfg);
    expect(key).toMatch(/^folder\/.+\.png$/);
    expect(putObjectMock).toHaveBeenCalledTimes(1);
  });

  it('uploadFromUrl rejects disallowed downloaded content types', async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<script>x</script>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })),
    );

    const cfg = {
      endpoint: 'https://s3.test',
      region: 'auto',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    };

    await expect(
      uploadFromUrl('https://example.com/x.html', 'folder', cfg, {
        allowedContentTypes: ['image/png'],
      }),
    ).rejects.toThrow(/content type not allowed/i);
    expect(putObjectMock).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', originalFetch);
  });

  it('uploadBase64Image rejects svg images before upload', async () => {
    const cfg = {
      endpoint: 'https://s3.test',
      region: 'auto',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    };

    await expect(
      uploadBase64Image('data:image/svg+xml;base64,PHN2Zy8+', 'folder', cfg),
    ).rejects.toThrow(/image type not allowed/i);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('uploadBase64Image rejects oversized payloads before upload', async () => {
    const cfg = {
      endpoint: 'https://s3.test',
      region: 'auto',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    };

    await expect(
      uploadBase64Image(`data:image/png;base64,${'A'.repeat(14 * 1024 * 1024)}`, 'folder', cfg),
    ).rejects.toThrow(/too large/i);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('StorageNotConfiguredError carries the STORAGE_NOT_CONFIGURED code', () => {
    const err = new StorageNotConfiguredError();
    expect(err.code).toBe('STORAGE_NOT_CONFIGURED');
    expect(err.message).toContain('Settings');
  });
});
