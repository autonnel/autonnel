import { AwsClient } from 'aws4fetch';
import type { ObjectStoragePort } from '../../application/ports/outbound';
import type { StorageKey } from '../../domain/value-objects/storage-key';

export interface R2Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

export class R2ObjectStorageAdapter implements ObjectStoragePort {
  private readonly client: AwsClient;
  constructor(private readonly cfg: R2Config) {
    this.client = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, region: 'auto', service: 's3' });
  }

  async put(key: StorageKey, bytes: Uint8Array, contentType: string): Promise<void> {
    const url = `${this.cfg.endpoint}/${this.cfg.bucket}/${key.value}`;
    const res = await this.client.fetch(url, { method: 'PUT', body: bytes as BodyInit, headers: { 'content-type': contentType } });
    if (!res.ok) throw new Error(`R2 put failed: ${res.status}`);
  }

  publicUrl(key: StorageKey): string {
    return `${this.cfg.publicBaseUrl}/${key.value}`;
  }
}
