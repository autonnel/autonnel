import { StepSlug } from '../value-objects/funnel-snapshot-ref';

export type StepOutcome = 'accepted' | 'declined' | 'completed';

export class StepRoutingPolicy {
  nextStep(current: StepSlug, _outcome: StepOutcome, snapshotSteps: StepSlug[]): StepSlug {
    const idx = snapshotSteps.findIndex((s) => s.value === current.value);
    if (idx === -1) throw new Error('Current step is not in the snapshot');
    const next = snapshotSteps[idx + 1];
    if (!next) throw new Error('No next step after the terminal step');
    return next;
  }
}
