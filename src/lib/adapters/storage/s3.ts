import { AwsClient } from 'aws4fetch';

export interface EdgeS3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  keyPrefix?: string;
}

const DEFAULT_REGION = 'auto';
const OCTET_STREAM = 'application/octet-stream';

interface ListedObject {
  key: string;
  size: number;
}

function captureGroups(source: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const hit of source.matchAll(pattern)) out.push(hit[1]);
  return out;
}

export class EdgeS3Client {
  private readonly client: AwsClient;
  private readonly origin: string;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(config: EdgeS3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: config.region || DEFAULT_REGION,
    });
    this.origin = config.endpoint.replace(/\/+$/, '');
    this.bucket = config.bucket;
    this.prefix = config.keyPrefix ?? '';
  }

  private toStorageKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private toLogicalKey(storageKey: string): string {
    if (this.prefix && storageKey.startsWith(this.prefix)) {
      return storageKey.slice(this.prefix.length);
    }
    return storageKey;
  }

  private objectEndpoint(key: string): string {
    return `${this.origin}/${this.bucket}/${this.toStorageKey(key)}`;
  }

  async putObject(
    key: string,
    body: ArrayBuffer | Uint8Array | string,
    contentType: string,
    cacheControl?: string,
  ): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (cacheControl) headers['Cache-Control'] = cacheControl;

    const res = await this.client.fetch(this.objectEndpoint(key), {
      method: 'PUT',
      headers,
      body: body as BodyInit,
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`PutObject failed: ${res.status} ${detail}`);
    }
  }

  async getObject(
    key: string,
  ): Promise<{ body: ArrayBuffer; contentType: string }> {
    const res = await this.client.fetch(this.objectEndpoint(key));
    if (!res.ok) {
      throw new Error(`GetObject failed: ${res.status}`);
    }
    return {
      body: await res.arrayBuffer(),
      contentType: res.headers.get('content-type') || OCTET_STREAM,
    };
  }

  async headObject(key: string): Promise<boolean> {
    const res = await this.client.fetch(this.objectEndpoint(key), {
      method: 'HEAD',
    });
    return res.ok;
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.fetch(this.objectEndpoint(key), { method: 'DELETE' });
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const copySource = `/${this.bucket}/${this.toStorageKey(sourceKey)}`;
    const res = await this.client.fetch(this.objectEndpoint(destKey), {
      method: 'PUT',
      headers: { 'x-amz-copy-source': copySource },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`CopyObject failed: ${res.status} ${detail}`);
    }
  }

  async listObjects(prefix: string, maxKeys = 1000): Promise<ListedObject[]> {
    const collected: ListedObject[] = [];
    const listPrefix = this.toStorageKey(prefix);
    const base = `${this.origin}/${this.bucket}?list-type=2&prefix=${encodeURIComponent(listPrefix)}&max-keys=${maxKeys}`;

    let cursor: string | undefined;
    while (true) {
      const target = cursor
        ? `${base}&continuation-token=${encodeURIComponent(cursor)}`
        : base;

      const res = await this.client.fetch(target);
      const xml = await res.text();

      const keys = captureGroups(xml, /<Key>([^<]+)<\/Key>/g);
      const sizes = captureGroups(xml, /<Size>(\d+)<\/Size>/g);

      for (let i = 0; i < keys.length; i++) {
        collected.push({
          key: this.toLogicalKey(keys[i]),
          size: parseInt(sizes[i]) || 0,
        });
      }

      const next = xml.match(
        /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/,
      );
      const truncated = xml.includes('<IsTruncated>true</IsTruncated>');
      if (!truncated || !next) break;
      cursor = next[1];
    }

    return collected;
  }

  private async signQuery(
    key: string,
    method: string,
    expiresIn: number,
    headers?: Record<string, string>,
  ): Promise<string> {
    const target = new URL(this.objectEndpoint(key));
    target.searchParams.set('X-Amz-Expires', String(expiresIn));
    const signed = await this.client.sign(
      new Request(target.toString(), { method, headers }),
      { aws: { signQuery: true } },
    );
    return signed.url;
  }

  getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<string> {
    return this.signQuery(key, 'PUT', expiresIn, {
      'Content-Type': contentType,
    });
  }

  getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.signQuery(key, 'GET', expiresIn);
  }
}
