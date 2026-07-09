import { MediaAsset } from '../../domain/media-asset';
import { StorageKey } from '../../domain/value-objects/storage-key';
import { Provenance } from '../../domain/value-objects/provenance';
import { MediaDescriptor } from '../../domain/value-objects/media-descriptor';
import type { Capability } from '../../domain/value-objects/capability';
import type { MediaAssetRepositoryPort } from '../../application/ports/outbound';

interface MediaAssetRow {
  id: string; storageKey: string; mediaType: string; contentType: string;
  width: number | null; height: number | null; durationSeconds: number | null;
  jobId: string; provider: string; modelId: string; promptHash: string; createdAt: Date;
}

interface PrismaLike {
  mediaAsset: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findUnique(args: { where: { id: string } }): Promise<MediaAssetRow | null>;
    findFirst(args: { where: { promptHash: string } }): Promise<MediaAssetRow | null>;
  };
}

export class PrismaMediaAssetRepository implements MediaAssetRepositoryPort {
  constructor(private readonly prisma: PrismaLike) {}

  async save(asset: MediaAsset): Promise<void> {
    await this.prisma.mediaAsset.create({
      data: {
        id: asset.id,
        storageKey: asset.storageKey.value,
        mediaType: asset.descriptor.mediaType,
        contentType: asset.descriptor.contentType,
        width: asset.descriptor.width,
        height: asset.descriptor.height,
        durationSeconds: asset.descriptor.durationSeconds,
        jobId: asset.provenance.jobId,
        provider: asset.provenance.provider,
        modelId: asset.provenance.modelId,
        promptHash: asset.promptHash,
      },
    });
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.hydrate(await this.prisma.mediaAsset.findUnique({ where: { id } }));
  }

  async findByPromptHash(promptHash: string): Promise<MediaAsset | null> {
    return this.hydrate(await this.prisma.mediaAsset.findFirst({ where: { promptHash } }));
  }

  private hydrate(row: MediaAssetRow | null): MediaAsset | null {
    if (!row) return null;
    return MediaAsset.create({
      id: row.id,
      storageKey: StorageKey.fromRaw(row.storageKey),
      descriptor: MediaDescriptor.create({
        mediaType: row.mediaType as Capability, contentType: row.contentType,
        width: row.width ?? undefined, height: row.height ?? undefined,
        durationSeconds: row.durationSeconds ?? undefined,
      }),
      provenance: Provenance.create({ jobId: row.jobId, provider: row.provider, modelId: row.modelId, promptHash: row.promptHash }),
      promptHash: row.promptHash,
      createdAt: row.createdAt,
    });
  }
}
