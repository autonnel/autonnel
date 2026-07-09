import { describe, it, expect } from 'vitest';
import { metaCapability } from './meta/capability';
import { googleCapability } from './google/capability';
import { tiktokCapability } from './tiktok/capability';
import { resolvePlatform, SUPPORTED_PLATFORMS } from './registry';

describe('platform capabilities', () => {
  it('declare required conversion scopes and dedup field per platform', () => {
    expect(metaCapability.platform).toBe('META');
    expect(metaCapability.dedupField).toBe('event_id');
    expect(metaCapability.requiredConversionScopes.length).toBeGreaterThan(0);
    expect(googleCapability.platform).toBe('GOOGLE');
    expect(tiktokCapability.platform).toBe('TIKTOK');
  });
});

describe('registry', () => {
  it('lists supported platforms and resolves by ref (case-insensitive)', () => {
    expect(SUPPORTED_PLATFORMS).toEqual(['META', 'GOOGLE', 'TIKTOK']);
    expect(resolvePlatform('meta')).toBe('META');
    expect(() => resolvePlatform('snapchat')).toThrow(/unsupported/i);
  });
});
