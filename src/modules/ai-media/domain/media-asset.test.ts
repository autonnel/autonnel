import { describe, it, expect } from 'vitest';
import { MediaAsset } from './media-asset';
import { StorageKey } from './value-objects/storage-key';
import { Provenance } from './value-objects/provenance';
import { MediaDescriptor } from './value-objects/media-descriptor';
import { TenantId } from '@/modules/shared-kernel/tenant-id';

function asset() {
  return MediaAsset.create({
    id: 'asset-1',
    storageKey: StorageKey.forAsset(TenantId.of('default'), 'asset-1', 'png'),
    descriptor: MediaDescriptor.create({ mediaType: 'IMAGE', contentType: 'image/png', width: 1, height: 1 }),
    provenance: Provenance.create({ jobId: 'j', provider: 'openai', modelId: 'm', promptHash: 'h' }),
    promptHash: 'h',
  });
}

describe('MediaAsset', () => {
  it('requires a StorageKey and full Provenance', () => {
    const a = asset();
    expect(a.storageKey.value).toBe('tenant/default/media/asset-1.png');
    expect(a.provenance.jobId).toBe('j');
  });

  it('rejects an IMAGE descriptor backed by a video contentType', () => {
    expect(() =>
      MediaAsset.create({
        id: 'a',
        storageKey: StorageKey.forAsset(TenantId.of('default'), 'a', 'mp4'),
        descriptor: MediaDescriptor.create({ mediaType: 'IMAGE', contentType: 'video/mp4' }),
        provenance: Provenance.create({ jobId: 'j', provider: 'p', modelId: 'm', promptHash: 'h' }),
        promptHash: 'h',
      }),
    ).toThrow(/contentType.*mediaType|inconsistent/i);
  });

  it('is frozen / immutable', () => {
    const a = asset();
    expect(Object.isFrozen(a)).toBe(true);
    expect(() => {
      (a as unknown as { id: string }).id = 'x';
    }).toThrow();
  });
});
