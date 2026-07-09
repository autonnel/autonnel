// sessionId is the shared pseudonymous correlation key (Analytics/Ads/Recall all join on it).
export interface EventCorrelation {
  sessionId?: string;
  saleRef?: string;
  causationId?: string;
}

export interface DomainEvent {
  type: string;
  payload: Record<string, unknown>;
}

export interface DomainEventEnvelope<T = unknown> {
  eventId: string;
  type: string;
  tenantId: string;
  occurredAt: Date;
  payload: T;
  correlation: EventCorrelation;
}

export function makeEnvelope<T>(
  type: string,
  tenantId: string,
  payload: T,
  correlation: EventCorrelation = {},
): DomainEventEnvelope<T> {
  return { eventId: crypto.randomUUID(), type, tenantId, occurredAt: new Date(), payload, correlation };
}

export type DispatchStrategy = "INLINE_WAIT_UNTIL" | "CRON_POLL";

export interface EnqueueJobInput {
  kind: string;
  payload: unknown;
  idempotencyKey?: string;
  dispatch?: DispatchStrategy;
  runAfter?: Date;
  maxAttempts?: number;
  // When true, re-enqueuing the same idempotencyKey after the prior job reached a
  // terminal state requeues it (coalescing/debounce). Default: exactly-once dedup.
  coalesce?: boolean;
}

export interface JobEnqueuePort {
  enqueue(input: EnqueueJobInput): Promise<{ jobId: string; deduped: boolean }>;
}

export interface EventPublisherPort {
  publish(event: DomainEventEnvelope): Promise<void>;
  publishMany(events: DomainEventEnvelope[]): Promise<void>;
}

export interface DomainEventPublisherPort {
  publish(event: DomainEvent): Promise<void>;
}
