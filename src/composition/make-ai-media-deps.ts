import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { getBasePrisma } from '@/lib/db';
import { OutboxEventPublisher } from '@/modules/platform/infra/outbox-event-publisher';
import { getConfig } from '@/lib/config/get-config';
import { getStorageContext } from '@/lib/config/storage';
import { getSiteStaticUrl } from '@/lib/s3';
import { NormalizeAndStoreService } from '@/modules/ai-media/application/normalize-and-store-service';
import { R2ObjectStorageAdapter } from '@/modules/ai-media/infra/storage/r2-object-storage-adapter';
import { PrismaMediaAssetRepository } from '@/modules/ai-media/infra/prisma/prisma-media-asset-repository';
import { TenantId } from '@/modules/shared-kernel/tenant-id';
import { makeEnvelope } from '@/modules/shared-kernel/event-envelope';
import { getCurrentTenantId } from '@/lib/tenant/context';
import type { R2Config } from '@/modules/ai-media/infra/storage/r2-object-storage-adapter';
import type { EventPublisherPort } from '@/modules/ai-media/application/ports/outbound';

interface S3KvConfig {
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

async function resolveR2(): Promise<R2Config> {
  const s3 = (await getConfig<S3KvConfig>('storage.s3')) ?? {};
  const ctx = await getStorageContext();
  return {
    endpoint: s3.endpoint ?? '',
    bucket: s3.bucket ?? '',
    accessKeyId: s3.accessKeyId ?? '',
    secretAccessKey: s3.secretAccessKey ?? '',
    publicBaseUrl: getSiteStaticUrl(ctx.staticDomain, ctx.primaryDomain),
  };
}

export interface UploadMediaInput {
  bytes: Uint8Array;
  contentType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface AiMediaUploadPort {
  store(input: UploadMediaInput): Promise<{ assetId: string; url: string }>;
}

export async function makeAiMediaUpload(_ctx: { locals?: unknown }): Promise<AiMediaUploadPort> {
  const base = getBasePrisma();
  const events = new OutboxEventPublisher(base) as unknown as EventPublisherPort;
  const storage = new R2ObjectStorageAdapter(await resolveR2());
  const assetRepo = new PrismaMediaAssetRepository(getTenantPrisma() as never);
  const store = new NormalizeAndStoreService({
    storage,
    assetRepo,
    events: {
      async publish(event) {
        await events.publish(makeEnvelope(event.name, getCurrentTenantId(), event.payload));
      },
    },
    tenantId: () => TenantId.of(getCurrentTenantId()),
    idGen: () => crypto.randomUUID(),
  });
  return {
    async store(input) {
      const assetId = await store.store({
        jobId: 'upload',
        provider: 'upload',
        modelId: 'upload',
        promptHash: 'upload',
        output: {
          bytes: input.bytes,
          contentType: input.contentType,
          width: input.width,
          height: input.height,
          durationSeconds: input.durationSeconds,
        },
      });
      const asset = await assetRepo.findById(assetId);
      const url = asset ? storage.publicUrl(asset.storageKey) : '';
      return { assetId, url };
    },
  };
}
