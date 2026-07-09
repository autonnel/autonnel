import type { AdPlatform } from './click-identifier';

export type PlatformRef = AdPlatform;

export interface PlatformCapability {
  platform: PlatformRef;
  apiVersion: string;
  authorizeUrl: string;
  tokenUrl: string;
  requiredConversionScopes: string[];
  standardEventNames: string[];
  dedupField: string;
}

export function isConversionScopeSatisfied(granted: string[], required: string[]): boolean {
  const set = new Set(granted);
  return required.every((s) => set.has(s));
}
