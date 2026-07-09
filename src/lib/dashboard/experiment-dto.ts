import { normalizeWeights } from '@/modules/funnel-dashboard/domain/experiment';
import type { ExperimentWithArms } from '@/modules/funnel-dashboard/application/ports';
import type { ExperimentDto } from '@/contracts/funnel';

export function toExperimentDto({ experiment, arms, labels }: ExperimentWithArms): ExperimentDto {
  const pctById = new Map(normalizeWeights(arms).map((p) => [p.id, p.pct]));
  return {
    id: experiment.id,
    funnelId: experiment.funnelId,
    name: experiment.name,
    status: experiment.status,
    goal: experiment.goal,
    winnerArmId: experiment.winnerArmId,
    arms: arms.map((a) => ({
      id: a.id,
      name: a.name,
      isControl: a.isControl,
      weight: a.weight,
      pct: pctById.get(a.id) ?? 0,
      targetFunnelId: a.targetFunnelId,
      targetPageId: a.targetPageId,
      targetLabel: labels[a.id] ?? '',
      order: a.order,
    })),
  };
}
