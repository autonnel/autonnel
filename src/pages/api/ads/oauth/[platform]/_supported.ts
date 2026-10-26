import { canonicalAdsPlatform } from '@/lib/config/ads-apps';

// Bing has no OAuth adapter in core (see create-token-connection.service.ts: BING_ADS is
// token-mode only). canonicalPlatform in make-acquisition-ads.ts silently defaults any
// unrecognized platform to TikTok, so without this route-level check a BING_ADS request would
// pass getAdsOAuthApp's 412 guard (if a Bing app happens to be configured) and then build a
// TikTok authorize URL using Bing's credentials. Checked here, before any service is
// constructed, rather than by widening canonicalPlatform itself, which conversionApiFor also
// relies on.
export function unsupportedAdsOAuthPlatform(platform: string): Response | null {
  if (canonicalAdsPlatform(platform) !== 'BING_ADS') return null;
  return new Response(
    `Ads OAuth is not supported for "${platform}". Bing Ads supports token-mode conversions only.`,
    { status: 400 },
  );
}
