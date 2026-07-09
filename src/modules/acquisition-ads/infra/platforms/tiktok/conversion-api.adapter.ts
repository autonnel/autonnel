import type { PlatformConversionApiPort } from '../../../application/ports/outbound';

type FetchLike = typeof fetch;
const TRACK_URL = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

export class TikTokConversionApiAdapter implements PlatformConversionApiPort {
  readonly platform = 'TIKTOK' as const;
  // Arrow, not bare `fetch`: called as `this.fetchImpl(...)` a bare reference rebinds `this` and
  // Workers throws "Illegal invocation". The arrow always calls global fetch unbound.
  constructor(private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)) {}

  async sendConversion(
    input: Parameters<PlatformConversionApiPort['sendConversion']>[0],
  ): ReturnType<PlatformConversionApiPort['sendConversion']> {
    const ttclid = input.payload.clickIds.find((c) => c.field === 'ttclid');
    const body = {
      event_source: 'web',
      event_source_id: input.destination.externalId,
      data: [{
        event: input.event.eventName,
        event_time: Math.floor(input.event.eventTimeMs / 1000),
        event_id: input.event.eventId,
        user: {
          email: input.payload.hashedEmail,
          phone: input.payload.hashedPhone,
          ttclid: ttclid?.value,
        },
        properties: input.event.value
          ? { value: input.event.value.amountMinor / 100, currency: input.event.value.currencyCode }
          : undefined,
      }],
    };
    const res = await this.fetchImpl(TRACK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Access-Token': input.accessToken },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 429;
      return { acknowledged: false, error: `TIKTOK ${res.status}`, retryable };
    }
    const json = (await res.json()) as { code: number; message: string; request_id?: string };
    if (json.code === 0) return { acknowledged: true, providerRef: json.request_id };
    return { acknowledged: false, error: `TIKTOK code ${json.code}: ${json.message}`, retryable: false };
  }
}
