import { defineRoute, ApiError } from '@/lib/api/define-route';
import { setConfig, deleteConfig } from '@/lib/config/get-config';
import { getGoogleMapsApiKey, ConfigKeys } from '@/lib/config/keys';
import type { GoogleMapsWire } from '@/contracts/settings';

function maskApiKey(key: string | undefined): string {
  if (!key) return '';
  if (key.length <= 4) return '••••';
  return `••••${key.slice(-4)}`;
}

async function read(): Promise<GoogleMapsWire> {
  const apiKey = await getGoogleMapsApiKey();
  return { apiKeyMasked: maskApiKey(apiKey), hasConfig: Boolean(apiKey) };
}

export const GET = defineRoute('GET /api/settings/google-maps', { feature: 'SETTINGS_GOOGLE_MAPS' }, async () => read());

export const PUT = defineRoute('PUT /api/settings/google-maps', { feature: 'SETTINGS_GOOGLE_MAPS' }, async ({ input }) => {
  if (input && 'apiKey' in input) {
    const v = input.apiKey;
    if (v === null || v === '') {
      await deleteConfig(ConfigKeys.GOOGLE_MAPS_API_KEY.key);
    } else if (typeof v === 'string') {
      await setConfig(ConfigKeys.GOOGLE_MAPS_API_KEY.key, v.trim());
    } else {
      throw new ApiError(400, 'apiKey must be string or null');
    }
  }
  return read();
});
