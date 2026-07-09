
import { createLogger } from '@/lib/logger';
import { getCfBrowserRenderingAccountId, getCfBrowserRenderingApiToken } from '@/lib/config/keys';
import { assertSafeUrl } from '@/lib/utils/safe-url';
import { BrowserRenderingHttpError, BrowserRenderingNotConfiguredError } from './errors';

const logger = createLogger('CfBrowserRendering');

const DEFAULT_TIMEOUT_MS = 60_000;
const GOTO_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 3_000;

interface CfContentResponse {
  success?: boolean;
  result?: string;
  errors?: Array<{ code?: number; message?: string }>;
}

export async function fetchRenderedHtml(
  url: string,
  opts?: { timeoutMs?: number; accountId?: string; apiToken?: string },
): Promise<string> {
  await assertSafeUrl(url, { schemes: ['http:', 'https:'] });

  let accountId = opts?.accountId;
  let apiToken = opts?.apiToken;
  if (!accountId) accountId = await getCfBrowserRenderingAccountId();
  if (!apiToken) apiToken = await getCfBrowserRenderingApiToken();
  if (!accountId || !apiToken) throw new BrowserRenderingNotConfiguredError();

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/content`;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: 'load', timeout: GOTO_TIMEOUT_MS },
        actionTimeout: ACTION_TIMEOUT_MS,
        viewport: { width: 1280, height: 800 },
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      logger.warn('Browser Rendering non-2xx', { status: res.status, body: text.slice(0, 200) });
      throw new BrowserRenderingHttpError(res.status, text);
    }

    let payload: CfContentResponse;
    try {
      payload = JSON.parse(text) as CfContentResponse;
    } catch {
      throw new BrowserRenderingHttpError(res.status, `Non-JSON response: ${text.slice(0, 200)}`);
    }

    if (!payload.success || typeof payload.result !== 'string') {
      const msg = payload.errors?.map((e) => e.message).filter(Boolean).join('; ') || 'unknown error';
      throw new BrowserRenderingHttpError(res.status, msg);
    }

    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function isBrowserRenderingConfigured(): Promise<boolean> {
  const accountId = await getCfBrowserRenderingAccountId();
  const apiToken = await getCfBrowserRenderingApiToken();
  return Boolean(accountId && apiToken);
}

export async function fetchScreenshot(
  url: string,
  opts?: { timeoutMs?: number; accountId?: string; apiToken?: string; fullPage?: boolean },
): Promise<{ base64: string; contentType: string }> {
  await assertSafeUrl(url, { schemes: ['http:', 'https:'] });

  let accountId = opts?.accountId;
  let apiToken = opts?.apiToken;
  if (!accountId) accountId = await getCfBrowserRenderingAccountId();
  if (!apiToken) apiToken = await getCfBrowserRenderingApiToken();
  if (!accountId || !apiToken) throw new BrowserRenderingNotConfiguredError();

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: 'load', timeout: GOTO_TIMEOUT_MS },
        viewport: { width: 1280, height: 800 },
        screenshotOptions: { type: 'png', fullPage: opts?.fullPage ?? false },
      }),
      signal: controller.signal,
    });

    // The /screenshot endpoint returns raw PNG bytes on success, not JSON.
    if (!res.ok) {
      const body = await res.text();
      logger.warn('Browser Rendering screenshot non-2xx', { status: res.status, body: body.slice(0, 200) });
      throw new BrowserRenderingHttpError(res.status, body);
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'image/png';
    return { base64, contentType };
  } finally {
    clearTimeout(timer);
  }
}
