import type { AbTestAssignmentRepository } from '../../application/ports';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

export class PrismaAbTestAssignmentRepository implements AbTestAssignmentRepository {
  constructor(private readonly db: Client) {}

  async find(experimentId: string, trackingId: string): Promise<string | null> {
    const row = (await this.db.abTestAssignment.findFirst({
      where: { experimentId, trackingId },
      select: { armId: true },
    })) as { armId: string } | null;
    return row?.armId ?? null;
  }

  async assign(experimentId: string, trackingId: string, armId: string): Promise<void> {
    try {
      await this.db.abTestAssignment.create({
        data: { experimentId, trackingId, armId } as never,
      });
    } catch (err) {
      // A concurrent first-touch already persisted this visitor's arm; keep the existing row.
      if ((err as { code?: string })?.code !== 'P2002') throw err;
    }
  }
}
