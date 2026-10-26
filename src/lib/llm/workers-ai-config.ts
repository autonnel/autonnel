export const WORKERS_AI_PROVIDER = 'workers-ai';
export const WORKERS_AI_BINDING = 'AI';
export const WORKERS_AI_REST_BASE_URL_EXAMPLE = 'https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1';

const ACCOUNT_URL_PATTERN = /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/([0-9a-f]{32})\/ai(?:\/v1)?\/?$/i;

export function parseWorkersAiAccountId(baseUrl: string): string | undefined {
  return ACCOUNT_URL_PATTERN.exec(baseUrl.trim())?.[1];
}

// An empty base URL selects the Worker `AI` binding, which carries its own credentials.
export function usesWorkersAiBinding(provider: string, baseUrl: string): boolean {
  return provider === WORKERS_AI_PROVIDER && !baseUrl.trim();
}

export function validateWorkersAiBaseUrl(baseUrl: string): string | undefined {
  if (!baseUrl.trim() || parseWorkersAiAccountId(baseUrl)) return undefined;
  return `Workers AI base URL must look like ${WORKERS_AI_REST_BASE_URL_EXAMPLE}, or be empty to use the "${WORKERS_AI_BINDING}" binding`;
}
