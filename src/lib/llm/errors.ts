export class LlmNotConfiguredError extends Error {
  code = 'LLM_NOT_CONFIGURED' as const;
  constructor(message = 'LLM is not configured. Configure a text model in Settings → LLM.') {
    super(message);
    this.name = 'LlmNotConfiguredError';
  }
}

export class UnknownProviderError extends Error {
  code = 'UNKNOWN_PROVIDER' as const;
  constructor(public kind: 'text' | 'image' | 'video', public providerId: string) {
    super(`Unknown ${kind} provider: "${providerId}"`);
    this.name = 'UnknownProviderError';
  }
}

export class ProviderHttpError extends Error {
  code = 'PROVIDER_HTTP_ERROR' as const;
  constructor(public status: number, public bodyExcerpt: string) {
    super(`Provider HTTP ${status}${bodyExcerpt ? ` — ${bodyExcerpt}` : ''}`);
    this.name = 'ProviderHttpError';
  }
}

export class ProviderTimeoutError extends Error {
  code = 'PROVIDER_TIMEOUT' as const;
  constructor(public timeoutMs: number) {
    super(`Provider request timed out after ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
  }
}

export class PollTimeoutError extends Error {
  code = 'POLL_TIMEOUT' as const;
  constructor(public timeoutMs: number) {
    super(`Job poll timed out after ${timeoutMs}ms`);
    this.name = 'PollTimeoutError';
  }
}

export class UnsupportedFeatureError extends Error {
  code = 'UNSUPPORTED_FEATURE' as const;
  constructor(public feature: string, public providerId: string) {
    super(`Feature "${feature}" not supported by provider "${providerId}"`);
    this.name = 'UnsupportedFeatureError';
  }
}
