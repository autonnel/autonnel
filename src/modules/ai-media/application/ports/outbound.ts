import type { MediaAsset } from '../../domain/media-asset';
import type { StorageKey } from '../../domain/value-objects/storage-key';

export type { EventPublisherPort } from '@/modules/shared-kernel';

export interface ProviderBinaryResult {
  bytes: Uint8Array;
  contentType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface ObjectStoragePort {
  put(key: StorageKey, bytes: Uint8Array, contentType: string): Promise<void>;
  publicUrl(key: StorageKey): string;
}

export interface MediaAssetRepositoryPort {
  save(asset: MediaAsset): Promise<void>;
  findById(id: string): Promise<MediaAsset | null>;
  findByPromptHash(promptHash: string): Promise<MediaAsset | null>;
}

export interface AiMediaEventSink {
  publish(event: { name: string; payload: Record<string, unknown> }): Promise<void>;
}
