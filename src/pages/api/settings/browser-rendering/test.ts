import { defineRoute } from '@/lib/api/define-route';
import {
  fetchRenderedHtml,
  BrowserRenderingHttpError,
  BrowserRenderingNotConfiguredError,
} from '@/lib/services/page-import';
import type { BrowserRenderingTestResult } from '@/contracts/settings';

export const POST = defineRoute('POST /api/settings/browser-rendering/test', { feature: 'SETTINGS_BROWSER_RENDERING' }, async ({ input }): Promise<BrowserRenderingTestResult> => {
  const accountId = typeof input?.accountId === 'string' && input.accountId.trim() ? input.accountId.trim() : undefined;
  const apiToken = typeof input?.apiToken === 'string' && input.apiToken.trim() ? input.apiToken.trim() : undefined;

  try {
    const html = await fetchRenderedHtml('https://example.com', { timeoutMs: 30_000, accountId, apiToken });
    return { ok: true, htmlSize: html.length };
  } catch (err) {
    if (err instanceof BrowserRenderingNotConfiguredError) return { ok: false, error: 'Not configured' };
    if (err instanceof BrowserRenderingHttpError) return { ok: false, error: err.message };
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Unknown error: ${msg}` };
  }
});
