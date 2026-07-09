import { Postback, type DispatchContext } from '../../domain/postback/postback';
import { ConversionEvent } from '../../domain/value-objects/conversion-event';
import { RetryPolicy } from '../../domain/value-objects/retry-policy';
import { ClickIdentifier } from '../../domain/value-objects/click-identifier';
import { HashedIdentity } from '../../domain/value-objects/hashed-identity';
import { Money } from '../../../shared-kernel/money';
import type { PostbackRepositoryPort } from '../../application/ports/outbound';

function dispatchContextToDomain(raw: any): DispatchContext | undefined {
  if (!raw) return undefined;
  const clickIdentifiers = ((raw.clickIdentifiers as any[]) ?? []).map((c) =>
    ClickIdentifier.fromPersistence({
      platform: c.platform,
      field: c.field,
      value: c.value,
      rawParam: c.rawParam,
    }),
  );
  const hashedIdentity = HashedIdentity.fromContactHandle({
    emailSha256: raw.hashedIdentity?.email ?? undefined,
    phoneSha256: raw.hashedIdentity?.phone ?? undefined,
  });
  return { clickIdentifiers, hashedIdentity };
}

function dispatchContextToPersistence(ctx: DispatchContext | undefined) {
  if (!ctx) return null;
  return {
    clickIdentifiers: ctx.clickIdentifiers.map((c) => ({
      platform: c.platform,
      field: c.field,
      value: c.value,
      rawParam: c.rawParam,
    })),
    hashedIdentity: {
      email: ctx.hashedIdentity.email ?? null,
      phone: ctx.hashedIdentity.phone ?? null,
    },
  };
}

interface PostbackDelegate {
  upsert(args: { where: { id: string }; create: any; update: any }): Promise<unknown>;
  findFirst(args: { where: Record<string, unknown> }): Promise<any | null>;
  findMany?(args: unknown): Promise<any[]>;
}

function toDomain(row: any): Postback {
  const value = row.eventSnapshot.value
    ? Money.of(row.eventSnapshot.value.amountMinor, row.eventSnapshot.value.currencyCode)
    : undefined;
  const event = ConversionEvent.create({
    eventName: row.eventSnapshot.eventName,
    eventId: row.eventSnapshot.eventId,
    eventTimeMs: row.eventSnapshot.eventTimeMs,
    value,
  });
  return Postback.reconstitute({
    id: row.id,
    destinationId: row.destinationId,
    event,
    retryPolicy: RetryPolicy.default(),
    status: row.status,
    attemptCount: row.attemptCount,
    attempts: row.attempts as import('../../domain/postback/postback').AttemptLog[],
    nextAttemptAt: row.nextAttemptAt ? new Date(row.nextAttemptAt).getTime() : undefined,
    providerRef: row.providerRef ?? undefined,
    dispatchContext: dispatchContextToDomain(row.eventSnapshot.dispatchContext),
  });
}

export class PrismaPostbackRepository implements PostbackRepositoryPort {
  constructor(private readonly delegate: PostbackDelegate) {}

  async save(pb: Postback): Promise<void> {
    const snapshot = {
      eventName: pb.event.eventName,
      eventId: pb.event.eventId,
      eventTimeMs: pb.event.eventTimeMs,
      value: pb.event.value
        ? { amountMinor: pb.event.value.amountMinor, currencyCode: pb.event.value.currencyCode }
        : null,
      dispatchContext: dispatchContextToPersistence(pb.dispatchContext),
    };
    const data = {
      id: pb.id,
      destinationId: pb.destinationId,
      eventId: pb.eventId,
      status: pb.status,
      attemptCount: pb.attemptCount,
      nextAttemptAt: pb.nextAttemptAt ? new Date(pb.nextAttemptAt) : null,
      providerRef: pb.providerRef ?? null,
      eventSnapshot: snapshot,
      attempts: pb.attempts,
    };
    await this.delegate.upsert({ where: { id: pb.id }, create: data, update: data });
  }

  async findByDedup(destinationId: string, eventId: string): Promise<Postback | null> {
    const row = await this.delegate.findFirst({ where: { destinationId, eventId } });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<Postback | null> {
    const row = await this.delegate.findFirst({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async claimDuePending(limit: number, nowMs: number): Promise<Postback[]> {
    const rows =
      (await this.delegate.findMany?.({
        where: {
          status: 'PENDING',
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date(nowMs) } }],
        },
        take: limit,
      })) ?? [];
    return rows.map(toDomain);
  }
}
