import { describe, it, expect, vi } from 'vitest';
import { NormalizeAndStoreService } from './normalize-and-store-service';
import { TenantId } from '@/modules/shared-kernel/tenant-id';

describe('NormalizeAndStoreService', () => {
  it('uploads bytes to R2 and creates an immutable MediaAsset', async () => {
    const put = vi.fn(async () => {});
    const saved: unknown[] = [];
    const published: string[] = [];
    const svc = new NormalizeAndStoreService({
      storage: { put, publicUrl: () => 'https://cdn/x.png' },
      assetRepo: { save: vi.fn(async (a: unknown) => { saved.push(a); }), findById: vi.fn(), findByPromptHash: vi.fn() },
      events: { publish: vi.fn(async (e: { name: string }) => { published.push(e.name); }) },
      tenantId: () => TenantId.of('default'),
      idGen: () => 'asset-1',
    } as never);

    const id = await svc.store({
      jobId: 'job1', provider: 'openai', modelId: 'm', promptHash: 'h',
      output: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png', width: 10, height: 10 },
    });

    expect(id).toBe('asset-1');
    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'tenant/default/media/asset-1.png' }),
      expect.any(Uint8Array),
      'image/png',
    );
    expect(published).toContain('ai_media.asset_stored');
  });
});
