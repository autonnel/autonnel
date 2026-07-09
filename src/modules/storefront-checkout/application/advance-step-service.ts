import { StepSlug } from '../domain/value-objects/funnel-snapshot-ref';
import { StepRoutingPolicy, type StepOutcome } from '../domain/services/step-routing-policy';
import type { FunnelSessionStorePort } from './ports/outbound';

export interface AdvanceStepDeps {
  sessions: FunnelSessionStorePort;
  ttlSeconds: number;
}

export class AdvanceStepService {
  private readonly routing = new StepRoutingPolicy();
  constructor(private readonly deps: AdvanceStepDeps) {}

  async execute(sessionId: string, outcome: StepOutcome): Promise<string> {
    const session = await this.deps.sessions.load(sessionId);
    if (!session) throw new Error('FunnelSession not found');
    const steps = session.stepSlugs.map((v) => StepSlug.of(v));
    const next = this.routing.nextStep(session.currentStep, outcome, steps);
    session.moveTo(next);
    await this.deps.sessions.store(session, this.deps.ttlSeconds);
    return next.value;
  }
}
