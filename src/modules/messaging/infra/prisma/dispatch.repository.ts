import { Dispatch } from '../../domain/dispatch';
import { DispatchStatus } from '../../domain/value-objects';
import { dispatchToRow, rowToDispatch, type DispatchRow } from './dispatch.mapper';
import type { DispatchRepositoryPort } from '../../application/ports/outbound';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

// tenantId is auto-injected by the Prisma tenant extension; the unique is (tenantId, idempotencyKey).
export class PrismaDispatchRepository implements DispatchRepositoryPort {
  constructor(private readonly db: Client | any) {}

  async findById(dispatchId: string): Promise<Dispatch | null> {
    const row = await this.db.dispatch.findUnique({ where: { id: dispatchId } });
    return row ? rowToDispatch(row as DispatchRow) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Dispatch | null> {
    const row = await this.db.dispatch.findFirst({ where: { idempotencyKey } });
    return row ? rowToDispatch(row as DispatchRow) : null;
  }

  async findByProviderMessageId(providerMessageId: string): Promise<Dispatch | null> {
    const row = await this.db.dispatch.findFirst({ where: { providerMessageId } });
    return row ? rowToDispatch(row as DispatchRow) : null;
  }

  async findRetryable(limit: number, now: Date): Promise<Dispatch[]> {
    const rows = await this.db.dispatch.findMany({
      where: { status: DispatchStatus.FAILED, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r: DispatchRow) => rowToDispatch(r));
  }

  async save(dispatch: Dispatch): Promise<Dispatch> {
    const data = dispatchToRow(dispatch);
    if (dispatch.id) {
      const row = await this.db.dispatch.update({ where: { id: dispatch.id }, data });
      return rowToDispatch(row as DispatchRow);
    }
    const row = await this.db.dispatch.create({ data });
    dispatch.id = row.id;
    return rowToDispatch(row as DispatchRow);
  }

  // Records a Dispatch ledger row for a channel that delivers synchronously outside the template
  // pipeline (Slack/webhook event notifications), already in a terminal SENT/FAILED state. The
  // (tenantId, idempotencyKey) unique guarantees exactly one row under outbox at-least-once redelivery.
  async recordTerminal(input: {
    idempotencyKey: string;
    channel: string;
    recipient: string;
    templateKey: string;
    sourceContext: string;
    sourceEventId?: string;
    subject?: string;
    status: 'SENT' | 'FAILED';
    error?: string;
  }): Promise<{ id: string; deduped: boolean }> {
    try {
      const row = await this.db.dispatch.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          channel: input.channel,
          recipient: input.recipient,
          templateKey: input.templateKey,
          templateVersionId: 'external',
          senderIdentityId: 'external',
          status: input.status,
          attemptCount: 1,
          lastError: input.error ?? null,
          sourceContext: input.sourceContext,
          sourceEventId: input.sourceEventId ?? null,
          renderedSubject: input.subject ?? null,
        },
      });
      return { id: row.id as string, deduped: false };
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const existing = await this.db.dispatch.findFirst({ where: { idempotencyKey: input.idempotencyKey } });
        return { id: (existing?.id as string) ?? '', deduped: true };
      }
      throw err;
    }
  }
}
