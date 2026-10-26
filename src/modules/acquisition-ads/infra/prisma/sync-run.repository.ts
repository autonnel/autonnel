import type { AdSyncRunRepositoryPort } from '../../application/ports/outbound';

interface SyncRunDelegate {
  create(args: unknown): Promise<any>;
  update(args: unknown): Promise<unknown>;
}

export class PrismaAdSyncRunRepository implements AdSyncRunRepositoryPort {
  constructor(
    private readonly delegate: SyncRunDelegate,
    private readonly newId: () => string,
  ) {}

  async start(input: { connectionId: string; windowStart: string; windowEnd: string }): Promise<string> {
    const id = this.newId();
    await this.delegate.create({
      data: {
        id,
        connectionId: input.connectionId,
        startedAt: new Date(),
        status: 'RUNNING',
        windowStart: new Date(`${input.windowStart}T00:00:00.000Z`),
        windowEnd: new Date(`${input.windowEnd}T00:00:00.000Z`),
      },
    });
    return id;
  }

  async finish(input: {
    runId: string;
    status: 'OK' | 'FAILED';
    adsFetched: number;
    daysUpserted: number;
    truncated: boolean;
    error?: string;
  }): Promise<void> {
    await this.delegate.update({
      where: { id: input.runId },
      data: {
        finishedAt: new Date(),
        status: input.status,
        adsFetched: input.adsFetched,
        daysUpserted: input.daysUpserted,
        truncated: input.truncated,
        error: input.error ?? null,
      },
    });
  }
}
