import { getCurrentTenantId } from "../../../lib/tenant/context";
import {
  makeEnvelope,
  type DomainEventPublisherPort,
  type EventCorrelation,
  type EventPublisherPort,
} from "../../shared-kernel/event-envelope";

// Some domain events (payments) carry saleRef/sessionId as siblings of payload rather than inside
// it. Lift them into the envelope correlation so cross-context routers can join on them.
function correlationFromEvent(event: { saleRef?: unknown; sessionId?: unknown }): EventCorrelation {
  const correlation: EventCorrelation = {};
  if (typeof event.saleRef === "string") correlation.saleRef = event.saleRef;
  if (typeof event.sessionId === "string") correlation.sessionId = event.sessionId;
  return correlation;
}

// Enriches a partial event ({ type, payload }) with the ALS-scoped tenantId plus a fresh
// eventId/occurredAt, then persists the full envelope via the outbox. The param is the widened
// shape (payload: unknown) so it also satisfies the handoff services' inline publisher ports.
export class TenantEventPublisher implements DomainEventPublisherPort {
  constructor(private readonly outbox: EventPublisherPort) {}

  async publish(event: { type: string; payload: unknown }): Promise<void> {
    const correlation = correlationFromEvent(event as { saleRef?: unknown; sessionId?: unknown });
    await this.outbox.publish(makeEnvelope(event.type, getCurrentTenantId(), event.payload, correlation));
  }
}
