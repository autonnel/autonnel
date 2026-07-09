import { Experiment, ExperimentArm, type ExperimentGoal, type ExperimentStatus } from '../../domain/experiment';
import type { ExperimentRepository, ExperimentWithArms } from '../../application/ports';

type Client = ReturnType<typeof import('../../../platform/infra/prisma-tenant-extension').getTenantPrisma>;

interface ExperimentRow {
  id: string;
  tenantId: string;
  funnelId: string;
  name: string;
  status: string;
  goal: unknown;
  winnerArmId: string | null;
}

interface ArmRow {
  id: string;
  experimentId: string;
  name: string;
  isControl: boolean;
  weight: number;
  targetFunnelId: string | null;
  targetPageId: string | null;
  order: number;
}

function toExperiment(row: ExperimentRow): Experiment {
  return Experiment.rehydrate({
    id: row.id,
    tenantId: row.tenantId,
    funnelId: row.funnelId,
    name: row.name,
    status: row.status as ExperimentStatus,
    goal: row.goal as ExperimentGoal,
    winnerArmId: row.winnerArmId,
  });
}

function toArm(row: ArmRow): ExperimentArm {
  return ExperimentArm.rehydrate({
    id: row.id,
    experimentId: row.experimentId,
    name: row.name,
    isControl: row.isControl,
    weight: row.weight,
    targetFunnelId: row.targetFunnelId,
    targetPageId: row.targetPageId,
    order: row.order,
  });
}

export class PrismaExperimentRepository implements ExperimentRepository {
  constructor(private readonly db: Client) {}

  async findByFunnel(funnelId: string): Promise<ExperimentWithArms | null> {
    const row = (await this.db.experiment.findFirst({ where: { funnelId } })) as ExperimentRow | null;
    if (!row) return null;
    return this.assemble(row);
  }

  async findExperimentIdByFunnel(funnelId: string): Promise<string | null> {
    const row = await this.db.experiment.findFirst({ where: { funnelId }, select: { id: true } });
    return row?.id ?? null;
  }

  async findStartedAt(experimentId: string): Promise<Date | null> {
    const row = (await this.db.experiment.findFirst({
      where: { id: experimentId },
      select: { startedAt: true },
    })) as { startedAt: Date | null } | null;
    return row?.startedAt ?? null;
  }

  async create(input: { funnelId: string; name: string; goal: ExperimentGoal }): Promise<ExperimentWithArms> {
    const row = (await this.db.experiment.create({
      data: { funnelId: input.funnelId, name: input.name, status: 'draft', goal: input.goal } as never,
    })) as ExperimentRow;
    return this.assemble(row);
  }

  async updateExperiment(
    exp: Experiment,
    opts?: { justStarted?: boolean; justConcluded?: boolean },
  ): Promise<ExperimentWithArms> {
    const data: Record<string, unknown> = {
      name: exp.name,
      status: exp.status,
      goal: exp.goal,
      winnerArmId: exp.winnerArmId,
    };
    if (opts?.justStarted) data.startedAt = new Date();
    if (opts?.justConcluded) data.concludedAt = new Date();
    const row = (await this.db.experiment.update({
      where: { id: exp.id },
      data: data as never,
    })) as ExperimentRow;
    return this.assemble(row);
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await this.db.experiment.delete({ where: { id: experimentId } });
  }

  async addArm(arm: ExperimentArm): Promise<ExperimentWithArms> {
    await this.db.experimentArm.create({
      data: {
        experimentId: arm.experimentId,
        name: arm.name,
        isControl: arm.isControl,
        weight: arm.weight,
        targetFunnelId: arm.targetFunnelId,
        targetPageId: arm.targetPageId,
        order: arm.order,
      } as never,
    });
    return this.assembleByExperimentId(arm.experimentId);
  }

  async updateArm(arm: ExperimentArm): Promise<ExperimentWithArms> {
    await this.db.experimentArm.update({
      where: { id: arm.id },
      data: { name: arm.name, weight: arm.weight } as never,
    });
    return this.assembleByExperimentId(arm.experimentId);
  }

  async deleteArm(armId: string): Promise<ExperimentWithArms> {
    const arm = (await this.db.experimentArm.findFirst({
      where: { id: armId },
      select: { experimentId: true },
    })) as { experimentId: string } | null;
    await this.db.experimentArm.delete({ where: { id: armId } });
    if (!arm) throw new Error(`Arm not found: ${armId}`);
    return this.assembleByExperimentId(arm.experimentId);
  }

  private async assembleByExperimentId(experimentId: string): Promise<ExperimentWithArms> {
    const row = (await this.db.experiment.findFirst({ where: { id: experimentId } })) as ExperimentRow | null;
    if (!row) throw new Error(`Experiment not found: ${experimentId}`);
    return this.assemble(row);
  }

  private async assemble(row: ExperimentRow): Promise<ExperimentWithArms> {
    const armRows = (await this.db.experimentArm.findMany({
      where: { experimentId: row.id },
      orderBy: { order: 'asc' },
    })) as ArmRow[];
    const arms = armRows.map(toArm);
    const labels = await this.resolveLabels(arms);
    return { experiment: toExperiment(row), arms, labels };
  }

  private async resolveLabels(arms: ExperimentArm[]): Promise<Record<string, string>> {
    const funnelIds = arms.map((a) => a.targetFunnelId).filter((id): id is string => !!id);
    const pageIds = arms.map((a) => a.targetPageId).filter((id): id is string => !!id);

    const funnelNames = funnelIds.length
      ? new Map(
          (
            (await this.db.funnel.findMany({
              where: { id: { in: funnelIds } },
              select: { id: true, name: true },
            })) as Array<{ id: string; name: string }>
          ).map((f) => [f.id, f.name]),
        )
      : new Map<string, string>();

    const pageNames = pageIds.length
      ? new Map(
          (
            (await this.db.page.findMany({
              where: { id: { in: pageIds } },
              select: { id: true, name: true, slug: true },
            })) as Array<{ id: string; name: string; slug: string }>
          ).map((p) => [p.id, p.name || p.slug || p.id]),
        )
      : new Map<string, string>();

    const labels: Record<string, string> = {};
    for (const arm of arms) {
      if (arm.targetFunnelId) labels[arm.id] = funnelNames.get(arm.targetFunnelId) ?? arm.targetFunnelId;
      else if (arm.targetPageId) labels[arm.id] = pageNames.get(arm.targetPageId) ?? arm.targetPageId;
      else labels[arm.id] = '';
    }
    return labels;
  }
}
