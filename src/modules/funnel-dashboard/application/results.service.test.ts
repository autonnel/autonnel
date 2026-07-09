import { describe, it, expect, vi } from 'vitest';
import { ExperimentResultsService } from './results.service';
import { Experiment, ExperimentArm } from '../domain/experiment';
import type {
  ArmCounts,
  ExperimentRepository,
  ExperimentResultsReadPort,
  ExperimentWithArms,
} from './ports';
import type { ExperimentGoal } from '../domain/experiment';

function experiment(over: Partial<{ status: 'draft' | 'running' | 'concluded'; goal: ExperimentGoal; winnerArmId: string | null }> = {}): Experiment {
  return Experiment.rehydrate({
    id: 'e1',
    tenantId: 't',
    funnelId: 'f1',
    name: 'Test',
    status: over.status ?? 'running',
    goal: over.goal ?? { kind: 'order' },
    winnerArmId: over.winnerArmId ?? null,
  });
}

function arm(id: string, over: Partial<{ isControl: boolean; order: number }> = {}): ExperimentArm {
  return ExperimentArm.rehydrate({
    id,
    experimentId: 'e1',
    name: id,
    weight: 50,
    isControl: over.isControl ?? false,
    targetFunnelId: 'f1',
    targetPageId: null,
    order: over.order ?? 0,
  });
}

function withArms(exp: Experiment, arms: ExperimentArm[]): ExperimentWithArms {
  return { experiment: exp, arms, labels: {} };
}

function makeRepo(loaded: ExperimentWithArms | null, startedAt: Date | null = null): ExperimentRepository {
  return {
    findByFunnel: vi.fn().mockResolvedValue(loaded),
    findStartedAt: vi.fn().mockResolvedValue(startedAt),
  } as unknown as ExperimentRepository;
}

function makePort(counts: ArmCounts[]): ExperimentResultsReadPort {
  return { countByArm: vi.fn().mockResolvedValue(counts) };
}

describe('ExperimentResultsService', () => {
  it('returns null when no experiment exists', async () => {
    const svc = new ExperimentResultsService(makePort([]), makeRepo(null));
    expect(await svc.get('f1')).toBeNull();
  });

  it('returns null for a draft experiment (no results yet)', async () => {
    const repo = makeRepo(withArms(experiment({ status: 'draft' }), [arm('a', { isControl: true }), arm('b')]));
    const port = makePort([]);
    const svc = new ExperimentResultsService(port, repo);
    expect(await svc.get('f1')).toBeNull();
    expect(port.countByArm).not.toHaveBeenCalled();
  });

  it('computes order-goal conversion rate and lift vs control', async () => {
    const control = arm('a', { isControl: true, order: 0 });
    const variant = arm('b', { order: 1 });
    const repo = makeRepo(withArms(experiment(), [control, variant]));
    const port = makePort([
      { armId: 'a', entered: 100, converted: 10 },
      { armId: 'b', entered: 100, converted: 20 },
    ]);
    const out = await new ExperimentResultsService(port, repo).get('f1');
    expect(out).not.toBeNull();
    const controlRow = out!.arms.find((r) => r.armId === 'a')!;
    const variantRow = out!.arms.find((r) => r.armId === 'b')!;
    expect(controlRow.conversionRate).toBeCloseTo(0.1);
    expect(controlRow.lift).toBeNull();
    expect(variantRow.conversionRate).toBeCloseTo(0.2);
    expect(variantRow.lift).toBeCloseTo(1.0);
  });

  it('passes the experiment startedAt and goal through to the read port', async () => {
    const since = new Date('2026-01-01T00:00:00Z');
    const goal: ExperimentGoal = { kind: 'step_reached', stepId: 'checkout' };
    const repo = makeRepo(withArms(experiment({ goal }), [arm('a', { isControl: true })]), since);
    const port = makePort([{ armId: 'a', entered: 5, converted: 1 }]);
    await new ExperimentResultsService(port, repo).get('f1');
    expect(port.countByArm).toHaveBeenCalledWith({
      experimentId: 'e1',
      armIds: ['a'],
      since,
      goal: { kind: 'step_reached', stepId: 'checkout' },
    });
  });

  it('yields null lift when the control conversion rate is 0', async () => {
    const repo = makeRepo(withArms(experiment(), [arm('a', { isControl: true, order: 0 }), arm('b', { order: 1 })]));
    const port = makePort([
      { armId: 'a', entered: 50, converted: 0 },
      { armId: 'b', entered: 50, converted: 10 },
    ]);
    const out = await new ExperimentResultsService(port, repo).get('f1');
    const variantRow = out!.arms.find((r) => r.armId === 'b')!;
    expect(out!.arms.find((r) => r.armId === 'a')!.lift).toBeNull();
    expect(variantRow.lift).toBeNull();
    expect(variantRow.conversionRate).toBeCloseTo(0.2);
  });

  it('orders arms by their order field and defaults missing counts to 0/0', async () => {
    const repo = makeRepo(
      withArms(experiment(), [arm('b', { order: 2 }), arm('a', { isControl: true, order: 1 }), arm('c', { order: 0 })]),
    );
    const port = makePort([{ armId: 'a', entered: 10, converted: 1 }]);
    const out = await new ExperimentResultsService(port, repo).get('f1');
    expect(out!.arms.map((r) => r.armId)).toEqual(['c', 'a', 'b']);
    const cRow = out!.arms.find((r) => r.armId === 'c')!;
    expect(cRow.entered).toBe(0);
    expect(cRow.converted).toBe(0);
    expect(cRow.conversionRate).toBe(0);
  });

  it('carries through status and winnerArmId for a concluded experiment', async () => {
    const repo = makeRepo(withArms(experiment({ status: 'concluded', winnerArmId: 'b' }), [arm('a', { isControl: true }), arm('b')]));
    const port = makePort([
      { armId: 'a', entered: 1, converted: 0 },
      { armId: 'b', entered: 1, converted: 1 },
    ]);
    const out = await new ExperimentResultsService(port, repo).get('f1');
    expect(out!.status).toBe('concluded');
    expect(out!.winnerArmId).toBe('b');
  });
});
