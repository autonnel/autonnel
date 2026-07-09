import { Experiment, ExperimentArm, type ExperimentGoal } from '../domain/experiment';
import type { ExperimentRepository, ExperimentWithArms } from './ports';

export class ExperimentNotFoundError extends Error {
  constructor(funnelId: string) {
    super(`Experiment not found for funnel: ${funnelId}`);
    this.name = 'ExperimentNotFoundError';
  }
}

export class ManageExperimentService {
  constructor(private readonly repo: ExperimentRepository) {}

  get(funnelId: string): Promise<ExperimentWithArms | null> {
    return this.repo.findByFunnel(funnelId);
  }

  async create(funnelId: string, input: { name: string; goal: ExperimentGoal }): Promise<ExperimentWithArms> {
    if (!input.name) throw new Error('Experiment name is required');
    const existingId = await this.repo.findExperimentIdByFunnel(funnelId);
    if (existingId) throw new ExperimentExistsError(funnelId);

    const created = await this.repo.create({ funnelId, name: input.name, goal: input.goal });
    const experimentId = created.experiment.id;

    await this.repo.addArm(
      ExperimentArm.create({
        experimentId,
        name: 'Control',
        weight: 50,
        isControl: true,
        targetFunnelId: funnelId,
        order: 0,
      }),
    );
    return this.repo.addArm(
      ExperimentArm.create({
        experimentId,
        name: 'Variant B',
        weight: 50,
        isControl: false,
        targetFunnelId: funnelId,
        order: 1,
      }),
    );
  }

  async update(
    funnelId: string,
    patch: {
      name?: string;
      goal?: ExperimentGoal;
      action?: 'start' | 'conclude';
      winnerArmId?: string;
    },
  ): Promise<ExperimentWithArms> {
    const loaded = await this.repo.findByFunnel(funnelId);
    if (!loaded) throw new ExperimentNotFoundError(funnelId);
    const { experiment, arms } = loaded;

    if (patch.name !== undefined) {
      if (!patch.name) throw new Error('Experiment name is required');
      experiment.name = patch.name;
    }
    if (patch.goal !== undefined) experiment.goal = patch.goal;

    if (patch.action === 'start') {
      experiment.start();
    } else if (patch.action === 'conclude') {
      if (!patch.winnerArmId) throw new Error('winnerArmId is required to conclude');
      experiment.conclude(patch.winnerArmId, arms.map((a) => a.id));
    }

    return this.repo.updateExperiment(experiment, {
      justStarted: patch.action === 'start',
      justConcluded: patch.action === 'conclude',
    });
  }

  async remove(funnelId: string): Promise<void> {
    const id = await this.repo.findExperimentIdByFunnel(funnelId);
    if (!id) throw new ExperimentNotFoundError(funnelId);
    await this.repo.deleteExperiment(id);
  }

  async addArm(
    funnelId: string,
    input: { name: string; weight: number; targetFunnelId?: string; targetPageId?: string },
  ): Promise<ExperimentWithArms> {
    const loaded = await this.repo.findByFunnel(funnelId);
    if (!loaded) throw new ExperimentNotFoundError(funnelId);
    const order = loaded.arms.reduce((max, a) => Math.max(max, a.order), -1) + 1;
    const arm = ExperimentArm.create({
      experimentId: loaded.experiment.id,
      name: input.name,
      weight: input.weight,
      targetFunnelId: input.targetFunnelId ?? null,
      targetPageId: input.targetPageId ?? null,
      order,
    });
    return this.repo.addArm(arm);
  }

  async updateArm(
    funnelId: string,
    input: { armId: string; name?: string; weight?: number },
  ): Promise<ExperimentWithArms> {
    const loaded = await this.repo.findByFunnel(funnelId);
    if (!loaded) throw new ExperimentNotFoundError(funnelId);
    const arm = loaded.arms.find((a) => a.id === input.armId);
    if (!arm) throw new ExperimentNotFoundError(funnelId);
    arm.applyEdit({ name: input.name, weight: input.weight });
    return this.repo.updateArm(arm);
  }

  async removeArm(funnelId: string, armId: string): Promise<ExperimentWithArms> {
    const loaded = await this.repo.findByFunnel(funnelId);
    if (!loaded) throw new ExperimentNotFoundError(funnelId);
    if (!loaded.arms.some((a) => a.id === armId)) throw new ExperimentNotFoundError(funnelId);
    return this.repo.deleteArm(armId);
  }
}

export class ExperimentExistsError extends Error {
  constructor(funnelId: string) {
    super(`An experiment already exists for funnel: ${funnelId}`);
    this.name = 'ExperimentExistsError';
  }
}
