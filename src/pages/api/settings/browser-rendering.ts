import { defineRoute, ApiError } from '@/lib/api/define-route';
import { setConfig, deleteConfig } from '@/lib/config/get-config';
import {
  getCfBrowserRenderingAccountId,
  getCfBrowserRenderingApiToken,
  ConfigKeys,
} from '@/lib/config/keys';
import type { BrowserRenderingWire } from '@/contracts/settings';

function maskToken(token: string | undefined): string {
  if (!token) return '';
  if (token.length <= 4) return '••••';
  return `••••${token.slice(-4)}`;
}

async function buildPayload(): Promise<BrowserRenderingWire> {
  const [accountId, apiToken] = await Promise.all([
    getCfBrowserRenderingAccountId(),
    getCfBrowserRenderingApiToken(),
  ]);
  return { accountId: accountId ?? '', apiTokenMasked: maskToken(apiToken), hasToken: Boolean(apiToken) };
}

export const GET = defineRoute('GET /api/settings/browser-rendering', { feature: 'SETTINGS_BROWSER_RENDERING' }, async () => buildPayload());

export const PUT = defineRoute('PUT /api/settings/browser-rendering', { feature: 'SETTINGS_BROWSER_RENDERING' }, async ({ input }) => {
  if (input && 'accountId' in input) {
    const v = input.accountId;
    if (v === null || v === '') {
      await deleteConfig(ConfigKeys.CF_BROWSER_RENDERING_ACCOUNT_ID.key);
    } else if (typeof v === 'string') {
      await setConfig(ConfigKeys.CF_BROWSER_RENDERING_ACCOUNT_ID.key, v.trim());
    } else {
      throw new ApiError(400, 'accountId must be string or null');
    }
  }

  if (input && 'apiToken' in input) {
    const v = input.apiToken;
    if (v === null) {
      await deleteConfig(ConfigKeys.CF_BROWSER_RENDERING_API_TOKEN.key);
    } else if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed.length > 0) await setConfig(ConfigKeys.CF_BROWSER_RENDERING_API_TOKEN.key, trimmed);
    } else {
      throw new ApiError(400, 'apiToken must be string or null');
    }
  }

  return buildPayload();
});
