import type { Capability } from './capability';

export interface MediaDescriptorInput {
  mediaType: Capability;
  contentType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export class MediaDescriptor {
  private constructor(
    readonly mediaType: Capability,
    readonly contentType: string,
    readonly width: number | null,
    readonly height: number | null,
    readonly durationSeconds: number | null,
  ) {
    Object.freeze(this);
  }
  static create(input: MediaDescriptorInput): MediaDescriptor {
    if (!input.contentType) throw new Error('MediaDescriptor requires contentType');
    return new MediaDescriptor(
      input.mediaType,
      input.contentType,
      input.width ?? null,
      input.height ?? null,
      input.durationSeconds ?? null,
    );
  }
}
