import type { StorageKey } from './value-objects/storage-key';
import type { Provenance } from './value-objects/provenance';
import type { MediaDescriptor } from './value-objects/media-descriptor';

export interface MediaAssetCreateInput {
  id: string;
  storageKey: StorageKey;
  descriptor: MediaDescriptor;
  provenance: Provenance;
  promptHash: string;
  createdAt?: Date;
}

const CONTENT_TYPE_FAMILY: Record<string, 'TEXT' | 'IMAGE' | 'VIDEO'> = {
  image: 'IMAGE',
  video: 'VIDEO',
  text: 'TEXT',
  application: 'TEXT',
};

export class MediaAsset {
  private constructor(
    readonly id: string,
    readonly storageKey: StorageKey,
    readonly descriptor: MediaDescriptor,
    readonly provenance: Provenance,
    readonly promptHash: string,
    readonly createdAt: Date,
  ) {
    Object.freeze(this);
  }

  static create(i: MediaAssetCreateInput): MediaAsset {
    const family = CONTENT_TYPE_FAMILY[i.descriptor.contentType.split('/')[0] ?? ''];
    if (family && family !== i.descriptor.mediaType) {
      throw new Error(
        `inconsistent media: mediaType=${i.descriptor.mediaType} vs contentType=${i.descriptor.contentType}`,
      );
    }
    return new MediaAsset(i.id, i.storageKey, i.descriptor, i.provenance, i.promptHash, i.createdAt ?? new Date());
  }
}
