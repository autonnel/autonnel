import type { PlatformConversionApiPort } from '../../../application/ports/outbound';
import { googleCapability } from './capability';

type FetchLike = typeof fetch;

export class GoogleConversionApiAdapter implements PlatformConversionApiPort {
  readonly platform = 'GOOGLE' as const;
  // Arrow, not bare `fetch`: called as `this.fetchImpl(...)` a bare reference rebinds `this` and
  // Workers throws "Illegal invocation". The arrow always calls global fetch unbound.
  constructor(private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)) {}

  async sendConversion(
    input: Parameters<PlatformConversionApiPort['sendConversion']>[0],
  ): ReturnType<PlatformConversionApiPort['sendConversion']> {
    const gclid = input.payload.clickIds.find((c) => c.field === 'gclid');
    const userIdentifiers = input.payload.hashedEmail
      ? [{ hashedEmail: input.payload.hashedEmail }]
      : [];
    const conversions = [{
      gclid: gclid?.value,
      conversionDateTime: new Date(input.event.eventTimeMs).toISOString(),
      conversionValue: input.event.value ? input.event.value.amountMinor / 100 : undefined,
      currencyCode: input.event.value?.currencyCode,
      orderId: input.event.eventId,
      userIdentifiers,
    }];
    const url = `https://googleads.googleapis.com/${googleCapability.apiVersion}/${input.destination.externalId}:uploadClickConversions`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${input.accessToken}` },
      body: JSON.stringify({ conversions, partialFailure: true }),
    });
    if (res.ok) return { acknowledged: true, providerRef: input.event.eventId };
    const retryable = res.status >= 500 || res.status === 429;
    return { acknowledged: false, error: `GOOGLE ${res.status}`, retryable };
  }
}
