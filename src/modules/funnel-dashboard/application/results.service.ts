import type { ExperimentRepository, ExperimentResultsReadPort } from './ports';
import type { ExperimentResultsDto, ExperimentArmResultDto } from '@/contracts/funnel';

export class ExperimentResultsService {
  constructor(
    private readonly results: ExperimentResultsReadPort,
    private readonly experiments: ExperimentRepository,
  ) {}

  async get(funnelId: string): Promise<ExperimentResultsDto | null> {
    const loaded = await this.experiments.findByFunnel(funnelId);
    if (!loaded || loaded.experiment.status === 'draft') return null;
    const { experiment, arms } = loaded;

    const since = await this.experiments.findStartedAt(experiment.id);
    const counts = await this.results.countByArm({
      experimentId: experiment.id,
      armIds: arms.map((a) => a.id),
      since,
      goal: experiment.goal,
    });
    const countByArm = new Map(counts.map((c) => [c.armId, c]));

    const ordered = [...arms].sort((a, b) => a.order - b.order);
    const rateById = new Map<string, number>();
    for (const arm of ordered) {
      const c = countByArm.get(arm.id);
      const entered = c?.entered ?? 0;
      const converted = c?.converted ?? 0;
      rateById.set(arm.id, entered > 0 ? converted / entered : 0);
    }

    const control = ordered.find((a) => a.isControl);
    const controlRate = control ? rateById.get(control.id) ?? 0 : 0;

    const armResults: ExperimentArmResultDto[] = ordered.map((arm) => {
      const c = countByArm.get(arm.id);
      const entered = c?.entered ?? 0;
      const converted = c?.converted ?? 0;
      const conversionRate = rateById.get(arm.id) ?? 0;
      const lift =
        control && !arm.isControl && controlRate > 0 ? (conversionRate - controlRate) / controlRate : null;
      return {
        armId: arm.id,
        name: arm.name,
        isControl: arm.isControl,
        entered,
        converted,
        conversionRate,
        lift,
      };
    });

    return {
      experimentId: experiment.id,
      status: experiment.status as 'running' | 'concluded',
      goal: experiment.goal,
      winnerArmId: experiment.winnerArmId,
      arms: armResults,
    };
  }
}
