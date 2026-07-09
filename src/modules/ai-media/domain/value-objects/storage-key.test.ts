import { describe, it, expect } from 'vitest';
import { StorageKey } from './storage-key';
import { TenantId } from '@/modules/shared-kernel/tenant-id';

describe('StorageKey', () => {
  it('builds the canonical tenant-prefixed key', () => {
    const k = StorageKey.forAsset(TenantId.of('default'), 'asset123', 'png');
    expect(k.value).toBe('tenant/default/media/asset123.png');
  });

  it('rejects an empty extension', () => {
    expect(() => StorageKey.forAsset(TenantId.of('default'), 'a', '')).toThrow(/extension/i);
  });

  it('rejects a provider URL as canonical location', () => {
    expect(() => StorageKey.fromRaw('https://cdn.provider.com/x.png')).toThrow(/canonical/i);
  });

  it('accepts a well-formed raw key', () => {
    expect(StorageKey.fromRaw('tenant/t1/media/a.png').value).toBe('tenant/t1/media/a.png');
  });
});
