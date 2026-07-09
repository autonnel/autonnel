import type { PlatformConversionApiPort } from '../../../application/ports/outbound';
import { metaCapability } from './capability';

type FetchLike = typeof fetch;

export class MetaConversionApiAdapter implements PlatformConversionApiPort {
  readonly platform = 'META' as const;
  // Arrow, not bare `fetch`: called as `this.fetchImpl(...)` a bare reference rebinds `this` and
  // Workers throws "Illegal invocation". The arrow always calls global fetch unbound.
  constructor(private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)) {}

  async sendConversion(
    input: Parameters<PlatformConversionApiPort['sendConversion']>[0],
  ): ReturnType<PlatformConversionApiPort['sendConversion']> {
    const userData: Record<string, unknown> = {};
    if (input.payload.hashedEmail) userData.em = [input.payload.hashedEmail];
    if (input.payload.hashedPhone) userData.ph = [input.payload.hashedPhone];
    const fbc = input.payload.clickIds.find((c) => c.field === 'fbc');
    if (fbc) userData.fbc = fbc.value;

    const data = [{
      event_name: input.event.eventName,
      event_time: Math.floor(input.event.eventTimeMs / 1000),
      event_id: input.event.eventId,
      action_source: 'website',
      user_data: userData,
      custom_data: input.event.value
        ? { value: input.event.value.amountMinor / 100, currency: input.event.value.currencyCode }
        : undefined,
    }];

    const url = `https://graph.facebook.com/${metaCapability.apiVersion}/${input.destination.externalId}/events?access_token=${encodeURIComponent(input.accessToken)}`;
    const body: Record<string, unknown> = { data };
    if (input.testEventCode) body.test_event_code = input.testEventCode;

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = (await res.json()) as { fbtrace_id?: string };
      return { acknowledged: true, providerRef: json.fbtrace_id };
    }
    const retryable = res.status >= 500 || res.status === 429;
    return { acknowledged: false, error: `META CAPI ${res.status}`, retryable };
  }
}
