import { describe, it, expect, vi } from 'vitest';
import { PrismaMediaAssetRepository } from './prisma-media-asset-repository';
import { MediaAsset } from '../../domain/media-asset';
import { StorageKey } from '../../domain/value-objects/storage-key';
import { Provenance } from '../../domain/value-objects/provenance';
import { MediaDescriptor } from '../../domain/value-objects/media-descriptor';
import { TenantId } from '@/modules/shared-kernel/tenant-id';

function asset() {
  return MediaAsset.create({
    id: 'a1',
    storageKey: StorageKey.forAsset(TenantId.of('default'), 'a1', 'png'),
    descriptor: MediaDescriptor.create({ mediaType: 'IMAGE', contentType: 'image/png', width: 8, height: 8 }),
    provenance: Provenance.create({ jobId: 'j', provider: 'openai', modelId: 'm', promptHash: 'h' }),
    promptHash: 'h',
  });
}

describe('PrismaMediaAssetRepository', () => {
  it('persists the asset row without a tenant clause (extension injects it)', async () => {
    const create = vi.fn(async () => ({}));
    const repo = new PrismaMediaAssetRepository({ mediaAsset: { create, findUnique: vi.fn() } } as never);
    await repo.save(asset());
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'a1',
        storageKey: 'tenant/default/media/a1.png',
        contentType: 'image/png',
        mediaType: 'IMAGE',
        promptHash: 'h',
      }),
    });
  });

  it('rehydrates a MediaAsset from a row via findByPromptHash', async () => {
    const findFirst = vi.fn(async () => ({
      id: 'a1', storageKey: 'tenant/default/media/a1.png', mediaType: 'IMAGE', contentType: 'image/png',
      width: 8, height: 8, durationSeconds: null, jobId: 'j', provider: 'openai', modelId: 'm', promptHash: 'h',
      createdAt: new Date(),
    }));
    const repo = new PrismaMediaAssetRepository({ mediaAsset: { create: vi.fn(), findFirst, findUnique: vi.fn() } } as never);
    const a = await repo.findByPromptHash('h');
    expect(a?.id).toBe('a1');
    expect(a?.descriptor.mediaType).toBe('IMAGE');
  });
});
