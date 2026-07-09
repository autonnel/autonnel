
import type { AdsPlatformMeta } from '@/lib/plugins/types';

export const CORE_ADS_PLATFORMS: AdsPlatformMeta[] = [
  {
    id: 'FACEBOOK',
    label: 'Facebook (Conversions API)',
    mode: 'token',
    fields: [
      { key: 'pixelId', label: 'Pixel ID', placeholder: '123456789012345' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'EAA...' },
    ],
  },
  {
    id: 'TIKTOK',
    label: 'TikTok (Events API)',
    mode: 'token',
    fields: [
      { key: 'pixelCode', label: 'Pixel Code', placeholder: 'C1A2B3C4D5E6F7G8H9I0' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'tt-access-token' },
    ],
  },
  {
    id: 'BING_ADS',
    label: 'Bing Ads (CAPI)',
    mode: 'token',
    fields: [
      { key: 'uetTagId', label: 'UET Tag ID', placeholder: '123456789' },
      { key: 'capiToken', label: 'CAPI Token', placeholder: 'capi-token' },
    ],
  },
];

let pluginPlatforms: AdsPlatformMeta[] = [];

export function setPluginAdsPlatforms(items: AdsPlatformMeta[]): void {
  pluginPlatforms = items;
}

export function getAdsPlatforms(): AdsPlatformMeta[] {
  const byId = new Map<string, AdsPlatformMeta>();
  for (const p of CORE_ADS_PLATFORMS) byId.set(p.id, p);
  for (const p of pluginPlatforms) byId.set(p.id, p);
  return Array.from(byId.values());
}
