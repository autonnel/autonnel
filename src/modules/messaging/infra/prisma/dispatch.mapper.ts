import { Dispatch, type DispatchSnapshot } from '../../domain/dispatch';
import { SenderIdentity } from '../../domain/value-objects';
import { RenderedMessage } from '../../domain/rendered-message';

export interface DispatchRow {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  channel: string;
  recipient: string;
  templateKey: string;
  templateVersionId: string;
  senderIdentityId: string;
  status: string;
  attemptCount: number;
  providerSlug: string | null;
  providerMessageId: string | null;
  lastError: string | null;
  sourceContext: string;
  sourceEventId: string | null;
  traceId: string | null;
  renderedSubject: string | null;
  renderedHtml: string | null;
  renderedText: string | null;
  renderedHeaders: unknown;
  nextRetryAt: Date | null;
}

export function dispatchToRow(d: Dispatch): Omit<DispatchRow, 'id' | 'nextRetryAt'> & { id?: string } {
  const s = d.toSnapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    idempotencyKey: s.idempotencyKey,
    channel: s.channel,
    recipient: s.recipientNormalized,
    templateKey: s.templateKey,
    templateVersionId: s.templateVersionId,
    senderIdentityId: s.senderIdentityId,
    status: s.status,
    attemptCount: s.attemptCount,
    providerSlug: s.providerSlug ?? null,
    providerMessageId: s.providerMessageId ?? null,
    lastError: s.lastError ?? null,
    sourceContext: s.correlation.sourceContext,
    sourceEventId: s.correlation.sourceEventId ?? null,
    traceId: s.correlation.traceId ?? null,
    renderedSubject: s.renderedSubject ?? null,
    renderedHtml: s.renderedHtml ?? null,
    renderedText: s.renderedText ?? null,
    renderedHeaders: s.renderedHeaders ?? null,
  };
}

export function rowToDispatch(row: DispatchRow): Dispatch {
  const snapshot: DispatchSnapshot = {
    id: row.id,
    tenantId: row.tenantId,
    idempotencyKey: row.idempotencyKey,
    channel: row.channel as never,
    recipientNormalized: row.recipient,
    templateKey: row.templateKey,
    templateVersionId: row.templateVersionId,
    senderIdentityId: row.senderIdentityId,
    status: row.status as never,
    attemptCount: row.attemptCount,
    providerSlug: row.providerSlug ?? undefined,
    providerMessageId: row.providerMessageId ?? undefined,
    lastError: row.lastError ?? undefined,
    correlation: { sourceContext: row.sourceContext, sourceEventId: row.sourceEventId ?? undefined, traceId: row.traceId ?? undefined },
    renderedSubject: row.renderedSubject ?? undefined,
    renderedHtml: row.renderedHtml ?? undefined,
    renderedText: row.renderedText ?? undefined,
    renderedHeaders: (row.renderedHeaders as Record<string, string> | null) ?? undefined,
  };
  const rendered = row.renderedSubject
    ? RenderedMessage.of({ subject: row.renderedSubject, html: row.renderedHtml ?? '', text: row.renderedText ?? '', headers: (row.renderedHeaders as Record<string, string>) ?? {} })
    : undefined;
  // Placeholder uses the reserved .invalid TLD so it satisfies email validation without colliding with a real domain.
  const sender = rendered ? SenderIdentity.of({ fromAddress: 'placeholder@local.invalid', verified: true }) : undefined;
  return Dispatch.rehydrate(snapshot, rendered, sender);
}
