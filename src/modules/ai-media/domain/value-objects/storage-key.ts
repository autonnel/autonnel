import type { TenantId } from '@/modules/shared-kernel/tenant-id';

const KEY_RE = /^tenant\/[^/]+\/media\/[^/]+\.[A-Za-z0-9]+$/;

export class StorageKey {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static forAsset(tenantId: TenantId, assetId: string, ext: string): StorageKey {
    if (!ext || !/^[A-Za-z0-9]+$/.test(ext)) throw new Error('invalid file extension');
    return new StorageKey(`tenant/${tenantId.value}/media/${assetId}.${ext}`);
  }

  static fromRaw(raw: string): StorageKey {
    if (/^https?:\/\//i.test(raw)) {
      throw new Error('a provider URL is never the canonical StorageKey');
    }
    if (!KEY_RE.test(raw)) throw new Error('malformed StorageKey');
    return new StorageKey(raw);
  }
}
