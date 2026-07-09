import { AttributionTouch } from '../domain/value-objects/attribution-touch';
import { ClickIdentifier } from '../domain/value-objects/click-identifier';
import type { AttributionStorePort } from './ports/outbound';
import type { AttributionIngestPort } from './ports/inbound';

const ATTRIBUTION_TTL_SEC = 60 * 60 * 24 * 30;

export class CaptureAttributionService implements AttributionIngestPort {
  constructor(private readonly deps: { attributionStore: AttributionStorePort }) {}

  async capture(input: Parameters<AttributionIngestPort['capture']>[0]): Promise<{ stored: boolean }> {
    const touch = AttributionTouch.create({
      clickIdentifiers: ClickIdentifier.fromQuery(input.query, { landingUrlTimestampMs: input.landingTimestampMs }),
      fbp: input.fbp,
      ga: input.ga,
      landingUrl: input.landingUrl,
      transientIp: input.transientIp,
      transientUserAgent: input.transientUserAgent,
    });
    await this.deps.attributionStore.put({ key: `attr:${input.sessionId}`, touch, ttlSec: ATTRIBUTION_TTL_SEC });
    return { stored: true };
  }
}
