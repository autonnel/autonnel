import { defineRoute, ApiError } from '@/lib/api/define-route';
import { setConfig, deleteConfig } from '@/lib/config/get-config';
import { readConfigKey } from '@/lib/config/keys';
import { ADS_APP_KEYS, canonicalAdsPlatform, relayEnabledFor, getRelayBaseUrl, type AdsAppPlatform } from '@/lib/config/ads-apps';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import type { AdsAppsWire, AdsAppsPutInput, AdsAppConnectionWire } from '@/contracts/settings';

const PLATFORM_ORDER: AdsAppPlatform[] = ['META', 'TIKTOK', 'GOOGLE', 'BING_ADS'];

const PLATFORM_LABEL: Record<AdsAppPlatform, string> = {
  META: 'Meta Ads',
  TIKTOK: 'TikTok Ads',
  GOOGLE: 'Google Ads',
  BING_ADS: 'Bing Ads',
};

function maskClientId(id: string | undefined): string {
  if (!id) return '';
  if (id.length <= 4) return '••••';
  return `••••${id.slice(-4)}`;
}

export async function buildPayload(): Promise<AdsAppsWire> {
  const db = getTenantPrisma();
  const rows: Array<{ id: string; platform: string; externalAccountId: string; status: string; reportingTimezone: string | null }> =
    await db.adAccountConnection.findMany({
      select: { id: true, platform: true, externalAccountId: true, status: true, reportingTimezone: true },
    });

  const connectionsByPlatform = new Map<AdsAppPlatform, AdsAppConnectionWire[]>();
  for (const row of rows) {
    const platform = canonicalAdsPlatform(row.platform);
    const list = connectionsByPlatform.get(platform) ?? [];
    list.push({
      id: row.id,
      externalAccountId: row.externalAccountId,
      status: row.status,
      reportingTimezone: row.reportingTimezone,
    });
    connectionsByPlatform.set(platform, list);
  }

  // Resolved once per request: relayEnabled must reflect both platform capability and whether an
  // operator actually configured a relay, otherwise the settings UI offers a button that always 412s.
  const relayBaseUrl = await getRelayBaseUrl();

  const platforms = await Promise.all(
    PLATFORM_ORDER.map(async (platform) => {
      const keys = ADS_APP_KEYS[platform];
      // readConfigKey resolves envFallback to the actual env VALUE (see its own comment in
      // keys.ts); calling getConfig directly with `.envFallback` would fall back to the env VAR
      // NAME string instead, which reads as "configured" even when nothing is set.
      // Never resolve or return clientSecret/developerToken here; only their presence ever
      // reaches the wire.
      const [clientId, clientSecret] = await Promise.all([
        readConfigKey<string>(keys.clientId),
        readConfigKey<string>(keys.clientSecret),
      ]);
      const developerTokenKey = 'developerToken' in keys ? keys.developerToken : undefined;
      const developerToken = developerTokenKey ? await readConfigKey<string>(developerTokenKey) : undefined;

      return {
        platform,
        label: PLATFORM_LABEL[platform],
        hasConfig: Boolean(clientId && clientSecret),
        clientIdMasked: maskClientId(clientId),
        hasDeveloperToken: Boolean(developerToken),
        relayEnabled: relayEnabledFor(platform) && relayBaseUrl !== null,
        connections: connectionsByPlatform.get(platform) ?? [],
      };
    }),
  );

  return { platforms };
}

export const GET = defineRoute('GET /api/settings/ads', { feature: 'SETTINGS_ADS' }, async () => buildPayload());

export const PUT = defineRoute('PUT /api/settings/ads', { feature: 'SETTINGS_ADS' }, async ({ input }) => {
  const body = input as Partial<AdsAppsPutInput> | null;
  const platform = body?.platform;
  if (!platform || !PLATFORM_ORDER.includes(platform)) {
    throw new ApiError(400, 'platform is required');
  }
  const keys = ADS_APP_KEYS[platform];

  if (body && 'clientId' in body) {
    const v = body.clientId;
    if (v === null || v === '') {
      await deleteConfig(keys.clientId.key);
    } else if (typeof v === 'string') {
      await setConfig(keys.clientId.key, v.trim());
    } else {
      throw new ApiError(400, 'clientId must be string or null');
    }
  }

  if (body && 'clientSecret' in body) {
    const v = body.clientSecret;
    if (v === null) {
      await deleteConfig(keys.clientSecret.key);
    } else if (typeof v === 'string') {
      // Empty string means "keep the existing secret" -- the client never has the real value to
      // resend, so a blank field on save must not clear it.
      if (v.trim().length > 0) await setConfig(keys.clientSecret.key, v.trim());
    } else {
      throw new ApiError(400, 'clientSecret must be string or null');
    }
  }

  if ('developerToken' in keys && body && 'developerToken' in body) {
    const developerTokenKey = keys.developerToken;
    const v = body.developerToken;
    if (v === null) {
      await deleteConfig(developerTokenKey.key);
    } else if (typeof v === 'string') {
      if (v.trim().length > 0) await setConfig(developerTokenKey.key, v.trim());
    } else {
      throw new ApiError(400, 'developerToken must be string or null');
    }
  }

  return buildPayload();
});
