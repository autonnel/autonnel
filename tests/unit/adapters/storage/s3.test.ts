import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch, mockSign, ctorMock } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockSign: vi.fn(),
  ctorMock: vi.fn(),
}));

vi.mock('aws4fetch', () => ({
  AwsClient: vi.fn().mockImplementation((cfg) => {
    ctorMock(cfg);
    return { fetch: mockFetch, sign: mockSign };
  }),
}));

import { EdgeS3Client } from '@/lib/adapters/storage/s3';

const baseConfig = {
  endpoint: 'https://s3.example.com/',
  region: 'us-east-1',
  accessKeyId: 'AKIA',
  secretAccessKey: 'SECRET',
  bucket: 'my-bucket',
};

beforeEach(() => {
  vi.clearAllMocks();
});

function ok(body: any, headers: Record<string, string> = {}): any {
  return {
    ok: true, status: 200,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
    json: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body)).buffer,
    headers: { get: (k: string) => headers[k.toLowerCase()] || null },
  };
}

function fail(status: number, body = ''): any {
  return {
    ok: false, status,
    text: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
    headers: { get: () => null },
  };
}

describe('EdgeS3Client', () => {
  it('constructs AwsClient with the provided keys and S3 service', () => {
    new EdgeS3Client(baseConfig);
    expect(ctorMock).toHaveBeenCalledWith(expect.objectContaining({
      accessKeyId: 'AKIA', secretAccessKey: 'SECRET', service: 's3',
    }));
  });

  it('putObject PUTs the body and throws on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(ok({}));
    const c = new EdgeS3Client(baseConfig);
    await c.putObject('foo.txt', 'hello', 'text/plain');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://s3.example.com/my-bucket/foo.txt');
    expect(callArgs[1].method).toBe('PUT');
    expect(callArgs[1].headers['Content-Type']).toBe('text/plain');

    mockFetch.mockResolvedValueOnce(fail(403, 'denied'));
    await expect(c.putObject('foo.txt', 'x', 'text/plain')).rejects.toThrow(/PutObject failed/);
  });

  it('putObject sets Cache-Control header when provided', async () => {
    mockFetch.mockResolvedValueOnce(ok({}));
    await new EdgeS3Client(baseConfig).putObject('a.txt', 'x', 'text/plain', 'public, max-age=3600');
    expect(mockFetch.mock.calls[0][1].headers['Cache-Control']).toBe('public, max-age=3600');
  });

  it('getObject returns body and content-type', async () => {
    mockFetch.mockResolvedValueOnce(ok('contents', { 'content-type': 'text/html' }));
    const r = await new EdgeS3Client(baseConfig).getObject('foo.html');
    expect(r.contentType).toBe('text/html');
    expect(new TextDecoder().decode(new Uint8Array(r.body))).toBe('contents');
  });

  it('getObject throws on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(fail(404));
    await expect(new EdgeS3Client(baseConfig).getObject('missing.txt')).rejects.toThrow(/GetObject failed/);
  });

  it('headObject returns true on 2xx, false otherwise', async () => {
    mockFetch.mockResolvedValueOnce(ok({}));
    expect(await new EdgeS3Client(baseConfig).headObject('a')).toBe(true);
    mockFetch.mockResolvedValueOnce(fail(404));
    expect(await new EdgeS3Client(baseConfig).headObject('a')).toBe(false);
  });

  it('deleteObject sends a DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(ok({}));
    await new EdgeS3Client(baseConfig).deleteObject('foo.txt');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('copyObject sends PUT with x-amz-copy-source header', async () => {
    mockFetch.mockResolvedValueOnce(ok({}));
    await new EdgeS3Client(baseConfig).copyObject('src/a.txt', 'dst/a.txt');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://s3.example.com/my-bucket/dst/a.txt');
    expect(callArgs[1].method).toBe('PUT');
    expect(callArgs[1].headers['x-amz-copy-source']).toBe('/my-bucket/src/a.txt');
  });

  it('copyObject throws on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(fail(403, 'denied'));
    await expect(
      new EdgeS3Client(baseConfig).copyObject('src/a.txt', 'dst/a.txt'),
    ).rejects.toThrow(/CopyObject failed/);
  });

  it('listObjects parses XML response and follows continuation tokens', async () => {
    const page1 = `<ListBucketResult><Contents><Key>a.txt</Key><Size>10</Size></Contents><Contents><Key>b.txt</Key><Size>20</Size></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>tok2</NextContinuationToken></ListBucketResult>`;
    const page2 = `<ListBucketResult><Contents><Key>c.txt</Key><Size>30</Size></Contents><IsTruncated>false</IsTruncated></ListBucketResult>`;
    mockFetch.mockResolvedValueOnce(ok(page1));
    mockFetch.mockResolvedValueOnce(ok(page2));

    const result = await new EdgeS3Client(baseConfig).listObjects('prefix/');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ key: 'a.txt', size: 10 });
    expect(result[2]).toEqual({ key: 'c.txt', size: 30 });
  });

  it('getSignedUploadUrl returns a signed PUT URL with X-Amz-Signature', async () => {
    mockSign.mockImplementationOnce(async (req: Request) => {
      const u = new URL(req.url);
      u.searchParams.set('X-Amz-Signature', 'deadbeef');
      return { url: u.toString() };
    });
    const url = await new EdgeS3Client(baseConfig).getSignedUploadUrl('uploads/a.png', 'image/png', 600);
    expect(url).toContain('X-Amz-Signature=deadbeef');
    expect(url).toContain('X-Amz-Expires=600');
    expect(mockSign.mock.calls[0][1]).toEqual({ aws: { signQuery: true } });
    const signedReq = mockSign.mock.calls[0][0] as Request;
    expect(signedReq.method).toBe('PUT');
  });

  it('getSignedDownloadUrl returns a signed GET URL with X-Amz-Signature', async () => {
    mockSign.mockImplementationOnce(async (req: Request) => {
      const u = new URL(req.url);
      u.searchParams.set('X-Amz-Signature', 'cafef00d');
      return { url: u.toString() };
    });
    const url = await new EdgeS3Client(baseConfig).getSignedDownloadUrl('uploads/a.png', 900);
    expect(url).toContain('X-Amz-Signature=cafef00d');
    expect(url).toContain('X-Amz-Expires=900');
    const signedReq = mockSign.mock.calls[0][0] as Request;
    expect(signedReq.method).toBe('GET');
  });

  describe('keyPrefix support', () => {
    const prefixed = { ...baseConfig, keyPrefix: 'tenant-123/' };

    it('prepends keyPrefix on putObject', async () => {
      mockFetch.mockResolvedValueOnce(ok({}));
      await new EdgeS3Client(prefixed).putObject('uploads/foo.txt', 'x', 'text/plain');
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://s3.example.com/my-bucket/tenant-123/uploads/foo.txt',
      );
    });

    it('prepends keyPrefix on getObject', async () => {
      mockFetch.mockResolvedValueOnce(ok('hi', { 'content-type': 'text/plain' }));
      await new EdgeS3Client(prefixed).getObject('uploads/foo.txt');
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://s3.example.com/my-bucket/tenant-123/uploads/foo.txt',
      );
    });

    it('prepends keyPrefix on deleteObject', async () => {
      mockFetch.mockResolvedValueOnce(ok({}));
      await new EdgeS3Client(prefixed).deleteObject('uploads/foo.txt');
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://s3.example.com/my-bucket/tenant-123/uploads/foo.txt',
      );
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });

    it('prepends keyPrefix on the listObjects prefix and strips it from results', async () => {
      const xml = `<ListBucketResult><Contents><Key>tenant-123/uploads/a.txt</Key><Size>10</Size></Contents><IsTruncated>false</IsTruncated></ListBucketResult>`;
      mockFetch.mockResolvedValueOnce(ok(xml));
      const result = await new EdgeS3Client(prefixed).listObjects('uploads/');
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain(`prefix=${encodeURIComponent('tenant-123/uploads/')}`);
      expect(result).toEqual([{ key: 'uploads/a.txt', size: 10 }]);
    });

    it('prepends keyPrefix on getSignedUploadUrl / getSignedDownloadUrl', async () => {
      mockSign.mockImplementation(async (req: Request) => ({ url: req.url }));
      const upUrl = await new EdgeS3Client(prefixed).getSignedUploadUrl(
        'uploads/a.png', 'image/png', 60,
      );
      expect(upUrl).toContain('/my-bucket/tenant-123/uploads/a.png');
      const dlUrl = await new EdgeS3Client(prefixed).getSignedDownloadUrl(
        'uploads/a.png', 60,
      );
      expect(dlUrl).toContain('/my-bucket/tenant-123/uploads/a.png');
    });

    it('uses raw key when keyPrefix is empty (OSS default)', async () => {
      mockFetch.mockResolvedValueOnce(ok({}));
      await new EdgeS3Client({ ...baseConfig, keyPrefix: '' }).putObject(
        'uploads/foo.txt', 'x', 'text/plain',
      );
      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://s3.example.com/my-bucket/uploads/foo.txt',
      );
    });

    it('copyObject prefixes both source and destination keys', async () => {
      mockFetch.mockResolvedValueOnce(ok({}));
      await new EdgeS3Client(prefixed).copyObject('src/a.txt', 'dst/b.txt');
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://s3.example.com/my-bucket/tenant-123/dst/b.txt');
      expect(callArgs[1].headers['x-amz-copy-source']).toBe(
        '/my-bucket/tenant-123/src/a.txt',
      );
    });
  });
});
