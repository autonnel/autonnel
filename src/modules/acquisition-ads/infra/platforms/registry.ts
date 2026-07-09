import type { PlatformRef } from '../../domain/value-objects/platform-ref';

export const SUPPORTED_PLATFORMS: PlatformRef[] = ['META', 'GOOGLE', 'TIKTOK'];

export function resolvePlatform(input: string): PlatformRef {
  const upper = input.toUpperCase();
  const match = SUPPORTED_PLATFORMS.find((p) => p === upper);
  if (!match) throw new Error(`unsupported ad platform: ${input}`);
  return match;
}
