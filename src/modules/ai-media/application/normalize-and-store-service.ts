import { MediaAsset } from '../domain/media-asset';
import { StorageKey } from '../domain/value-objects/storage-key';
import { Provenance } from '../domain/value-objects/provenance';
import { MediaDescriptor } from '../domain/value-objects/media-descriptor';
import { MediaTypeClassifier } from '../domain/services/media-type-classifier';
import { AI_MEDIA_EVENTS } from '../domain/events';
import type { TenantId } from '@/modules/shared-kernel/tenant-id';
import type {
  ObjectStoragePort, MediaAssetRepositoryPort, ProviderBinaryResult, AiMediaEventSink,
} from './ports/outbound';

export interface NormalizeAndStoreDeps {
  storage: ObjectStoragePort;
  assetRepo: MediaAssetRepositoryPort;
  events: AiMediaEventSink;
  tenantId: () => TenantId;
  idGen: () => string;
}

export interface StoreInput {
  jobId: string;
  provider: string;
  modelId: string;
  promptHash: string;
  output: ProviderBinaryResult;
  assetId?: string;
}

export class NormalizeAndStoreService {
  private readonly classifier = new MediaTypeClassifier();
  constructor(private readonly d: NormalizeAndStoreDeps) {}

  async store(input: StoreInput): Promise<string> {
    const assetId = input.assetId ?? this.d.idGen();
    const ext = this.classifier.extensionOf(input.output.contentType);
    const key = StorageKey.forAsset(this.d.tenantId(), assetId, ext);

    await this.d.storage.put(key, input.output.bytes, input.output.contentType);

    const asset = MediaAsset.create({
      id: assetId,
      storageKey: key,
      descriptor: MediaDescriptor.create({
        mediaType: this.classifier.capabilityOf(input.output.contentType),
        contentType: input.output.contentType,
        width: input.output.width,
        height: input.output.height,
        durationSeconds: input.output.durationSeconds,
      }),
      provenance: Provenance.create({
        jobId: input.jobId, provider: input.provider, modelId: input.modelId, promptHash: input.promptHash,
      }),
      promptHash: input.promptHash,
    });

    await this.d.assetRepo.save(asset);
    await this.d.events.publish({ name: AI_MEDIA_EVENTS.MediaAssetStored, payload: { assetId, jobId: input.jobId } });
    return assetId;
  }
}
