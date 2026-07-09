export type ExperimentStatus = 'draft' | 'running' | 'concluded';

export type ExperimentGoal = { kind: 'order' } | { kind: 'step_reached'; stepId: string };

export class ExperimentArm {
  private constructor(
    public id: string,
    readonly experimentId: string,
    public name: string,
    public weight: number,
    public isControl: boolean,
    readonly targetFunnelId: string | null,
    readonly targetPageId: string | null,
    public order: number,
  ) {}

  static create(input: {
    experimentId: string;
    name: string;
    weight: number;
    isControl?: boolean;
    targetFunnelId?: string | null;
    targetPageId?: string | null;
    order?: number;
  }): ExperimentArm {
    if (!input.name) throw new Error('Arm name is required');
    ExperimentArm.assertWeight(input.weight);
    ExperimentArm.assertTarget(input.targetFunnelId, input.targetPageId);
    return new ExperimentArm(
      '',
      input.experimentId,
      input.name,
      input.weight,
      input.isControl === true,
      input.targetFunnelId ?? null,
      input.targetPageId ?? null,
      input.order ?? 0,
    );
  }

  static rehydrate(input: {
    id: string;
    experimentId: string;
    name: string;
    weight: number;
    isControl: boolean;
    targetFunnelId: string | null;
    targetPageId: string | null;
    order: number;
  }): ExperimentArm {
    return new ExperimentArm(
      input.id,
      input.experimentId,
      input.name,
      input.weight,
      input.isControl,
      input.targetFunnelId,
      input.targetPageId,
      input.order,
    );
  }

  applyEdit(patch: { name?: string; weight?: number; isControl?: boolean }): void {
    if (patch.name !== undefined) {
      if (!patch.name) throw new Error('Arm name is required');
      this.name = patch.name;
    }
    if (patch.weight !== undefined) {
      ExperimentArm.assertWeight(patch.weight);
      this.weight = patch.weight;
    }
    if (patch.isControl !== undefined) this.isControl = patch.isControl;
  }

  private static assertWeight(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Weight must be a non-negative integer');
    }
  }

  // An arm targets exactly one of a funnel or a page (XOR) — never both, never neither.
  private static assertTarget(targetFunnelId?: string | null, targetPageId?: string | null): void {
    const hasFunnel = !!targetFunnelId;
    const hasPage = !!targetPageId;
    if (hasFunnel === hasPage) {
      throw new Error('Arm must target exactly one of a funnel or a page');
    }
  }
}

export class Experiment {
  private constructor(
    public id: string,
    readonly tenantId: string,
    readonly funnelId: string,
    public name: string,
    public status: ExperimentStatus,
    public goal: ExperimentGoal,
    public winnerArmId: string | null,
  ) {}

  static create(input: {
    tenantId: string;
    funnelId: string;
    name: string;
    goal: ExperimentGoal;
  }): Experiment {
    if (!input.name) throw new Error('Experiment name is required');
    return new Experiment(
      '',
      input.tenantId,
      input.funnelId,
      input.name,
      'draft',
      input.goal,
      null,
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    funnelId: string;
    name: string;
    status: ExperimentStatus;
    goal: ExperimentGoal;
    winnerArmId: string | null;
  }): Experiment {
    return new Experiment(
      input.id,
      input.tenantId,
      input.funnelId,
      input.name,
      input.status,
      input.goal,
      input.winnerArmId,
    );
  }

  start(): void {
    assertTransition(this.status, 'running');
    this.status = 'running';
  }

  conclude(winnerArmId: string, armIds: ReadonlyArray<string>): void {
    assertTransition(this.status, 'concluded');
    if (!armIds.includes(winnerArmId)) {
      throw new Error('winnerArmId must reference an arm of this experiment');
    }
    this.status = 'concluded';
    this.winnerArmId = winnerArmId;
  }

  declareWinner(armId: string, armIds: ReadonlyArray<string>): void {
    this.conclude(armId, armIds);
  }
}

const ALLOWED_TRANSITIONS: Record<ExperimentStatus, ReadonlyArray<ExperimentStatus>> = {
  draft: ['running'],
  running: ['concluded'],
  concluded: [],
};

export function assertTransition(from: ExperimentStatus, to: ExperimentStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Illegal experiment transition: ${from} -> ${to}`);
  }
}

export function normalizeWeights(
  arms: ReadonlyArray<{ id: string; weight: number }>,
): Array<{ id: string; pct: number }> {
  const total = arms.reduce((sum, a) => sum + a.weight, 0);
  if (total === 0) return arms.map((a) => ({ id: a.id, pct: 0 }));
  return arms.map((a) => ({ id: a.id, pct: Math.round((a.weight / total) * 1000) / 10 }));
}

// FNV-1a 32-bit hash; offset basis 2166136261, prime 16777619; >>> 0 keeps it unsigned.
export function hash32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickArm<A extends { id: string; weight: number }>(
  experimentId: string,
  arms: ReadonlyArray<A>,
  trackingId: string,
): A | null {
  const active = arms.filter((a) => a.weight > 0);
  const total = active.reduce((sum, a) => sum + a.weight, 0);
  if (total === 0) return null;
  let bucket = hash32(`${experimentId}:${trackingId}`) % total;
  for (const arm of active) {
    if (bucket < arm.weight) return arm;
    bucket -= arm.weight;
  }
  return active[active.length - 1];
}
