import { pickArm, type ExperimentArm, type ExperimentStatus } from '../domain/experiment';
import type { AbTestAssignmentRepository } from './ports';

// Resolves which arm a visitor sees and persists that choice. The first weighted pick for a
// visitor is stored; every later visit returns the stored arm regardless of current weights, so
// editing arm weights mid-run only re-buckets visitors that were never assigned.
export async function assignArm(
  repo: AbTestAssignmentRepository,
  loaded: {
    experiment: { id: string; status: ExperimentStatus; winnerArmId: string | null };
    arms: ExperimentArm[];
  },
  trackingId: string,
): Promise<{ experimentId: string; arm: ExperimentArm } | null> {
  const { experiment, arms } = loaded;

  if (experiment.status === 'draft') return null;

  if (experiment.status === 'concluded') {
    if (!experiment.winnerArmId) return null;
    const winner = arms.find((a) => a.id === experiment.winnerArmId);
    return winner ? { experimentId: experiment.id, arm: winner } : null;
  }

  if (trackingId) {
    const assignedArmId = await repo.find(experiment.id, trackingId);
    if (assignedArmId) {
      const existing = arms.find((a) => a.id === assignedArmId);
      if (existing) return { experimentId: experiment.id, arm: existing };
    }
  }

  const arm = pickArm(experiment.id, arms, trackingId);
  if (!arm) return null;
  if (trackingId) await repo.assign(experiment.id, trackingId, arm.id);
  return { experimentId: experiment.id, arm };
}
