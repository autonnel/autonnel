import type { DomainEventEnvelope } from "../modules/shared-kernel/event-envelope";
import { createLogger } from "../lib/logger";

const logger = createLogger("EventDelivery");

export type EventHandler = (envelope: DomainEventEnvelope, locals?: unknown) => Promise<void>;

export class EventDeliveryError extends Error {
  constructor(eventType: string, eventId: string, readonly failures: unknown[]) {
    super(`event delivery failed for ${eventType} (${eventId}): ${failures.length} handler error(s)`);
    this.name = "EventDeliveryError";
  }
}

// At-least-once unit. Every routed handler runs (one bad consumer must not starve the others), then
// any failure throws so the outbox keeps the row unpublished for redelivery — idempotent consumers
// re-run safely. The best-effort admin notification fan-out runs only after a fully successful
// delivery, so redeliveries never duplicate it.
export async function deliverEnvelope(
  envelope: DomainEventEnvelope,
  handlers: EventHandler[],
  notify: (envelope: DomainEventEnvelope) => Promise<void>,
  locals?: unknown,
): Promise<void> {
  const failures: unknown[] = [];
  for (const handler of handlers) {
    try {
      await handler(envelope, locals);
    } catch (error) {
      logger.error("event delivery handler failed", { type: envelope.type, eventId: envelope.eventId, error });
      failures.push(error);
    }
  }
  if (failures.length > 0) throw new EventDeliveryError(envelope.type, envelope.eventId, failures);
  try {
    await notify(envelope);
  } catch (error) {
    logger.error("event notification fan-out failed", { type: envelope.type, eventId: envelope.eventId, error });
  }
}
