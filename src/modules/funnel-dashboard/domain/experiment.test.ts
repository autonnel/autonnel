import { describe, it, expect } from 'vitest';
import {
  Experiment,
  ExperimentArm,
  assertTransition,
  normalizeWeights,
  hash32,
  pickArm,
  type ExperimentGoal,
} from './experiment';

const orderGoal: ExperimentGoal = { kind: 'order' };

describe('ExperimentArm', () => {
  it('rejects both targets set', () => {
    expect(() =>
      ExperimentArm.create({
        experimentId: 'e1',
        name: 'A',
        weight: 50,
        targetFunnelId: 'f1',
        targetPageId: 'p1',
      }),
    ).toThrow(/exactly one/);
  });

  it('rejects neither target set', () => {
    expect(() => ExperimentArm.create({ experimentId: 'e1', name: 'A', weight: 50 })).toThrow(/exactly one/);
  });

  it('accepts a funnel-only target', () => {
    const arm = ExperimentArm.create({ experimentId: 'e1', name: 'A', weight: 50, targetFunnelId: 'f1' });
    expect(arm.targetFunnelId).toBe('f1');
    expect(arm.targetPageId).toBeNull();
    expect(arm.isControl).toBe(false);
  });

  it('accepts a page-only target', () => {
    const arm = ExperimentArm.create({ experimentId: 'e1', name: 'A', weight: 50, targetPageId: 'p1' });
    expect(arm.targetPageId).toBe('p1');
    expect(arm.targetFunnelId).toBeNull();
  });

  it('rejects negative weight', () => {
    expect(() =>
      ExperimentArm.create({ experimentId: 'e1', name: 'A', weight: -1, targetPageId: 'p1' }),
    ).toThrow(/non-negative integer/);
  });

  it('rejects non-integer weight', () => {
    expect(() =>
      ExperimentArm.create({ experimentId: 'e1', name: 'A', weight: 1.5, targetPageId: 'p1' }),
    ).toThrow(/non-negative integer/);
  });

  it('applyEdit validates weight and mutates fields', () => {
    const arm = ExperimentArm.create({ experimentId: 'e1', name: 'A', weight: 50, targetPageId: 'p1' });
    expect(() => arm.applyEdit({ weight: -3 })).toThrow(/non-negative integer/);
    arm.applyEdit({ name: 'B', weight: 70, isControl: true });
    expect(arm.name).toBe('B');
    expect(arm.weight).toBe(70);
    expect(arm.isControl).toBe(true);
  });
});

describe('Experiment lifecycle', () => {
  it('starts from draft', () => {
    const exp = Experiment.create({ tenantId: 't1', funnelId: 'f1', name: 'Headline', goal: orderGoal });
    expect(exp.status).toBe('draft');
    exp.start();
    expect(exp.status).toBe('running');
  });

  it('cannot conclude a draft', () => {
    const exp = Experiment.create({ tenantId: 't1', funnelId: 'f1', name: 'Headline', goal: orderGoal });
    expect(() => exp.conclude('arm1', ['arm1'])).toThrow(/Illegal experiment transition: draft -> concluded/);
  });

  it('requires a valid winner arm id to conclude', () => {
    const exp = Experiment.create({ tenantId: 't1', funnelId: 'f1', name: 'Headline', goal: orderGoal });
    exp.start();
    expect(() => exp.conclude('ghost', ['arm1', 'arm2'])).toThrow(/winnerArmId must reference an arm/);
    exp.conclude('arm2', ['arm1', 'arm2']);
    expect(exp.status).toBe('concluded');
    expect(exp.winnerArmId).toBe('arm2');
  });

  it('treats concluded as terminal', () => {
    const exp = Experiment.create({ tenantId: 't1', funnelId: 'f1', name: 'Headline', goal: orderGoal });
    exp.start();
    exp.conclude('arm1', ['arm1']);
    expect(() => exp.start()).toThrow(/Illegal experiment transition: concluded -> running/);
    expect(() => exp.conclude('arm1', ['arm1'])).toThrow(/Illegal experiment transition: concluded -> concluded/);
  });

  it('declareWinner is an alias for conclude', () => {
    const exp = Experiment.create({ tenantId: 't1', funnelId: 'f1', name: 'Headline', goal: orderGoal });
    exp.start();
    exp.declareWinner('arm1', ['arm1', 'arm2']);
    expect(exp.status).toBe('concluded');
    expect(exp.winnerArmId).toBe('arm1');
  });

  it('assertTransition guards the state machine directly', () => {
    expect(() => assertTransition('draft', 'concluded')).toThrow();
    expect(() => assertTransition('draft', 'running')).not.toThrow();
    expect(() => assertTransition('running', 'concluded')).not.toThrow();
  });
});

describe('normalizeWeights', () => {
  it('splits 50/50', () => {
    expect(normalizeWeights([
      { id: 'a', weight: 50 },
      { id: 'b', weight: 50 },
    ])).toEqual([
      { id: 'a', pct: 50 },
      { id: 'b', pct: 50 },
    ]);
  });

  it('computes thirds correctly', () => {
    const result = normalizeWeights([
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
      { id: 'c', weight: 1 },
    ]);
    expect(result).toEqual([
      { id: 'a', pct: 33.3 },
      { id: 'b', pct: 33.3 },
      { id: 'c', pct: 33.3 },
    ]);
  });

  it('returns all 0 when total weight is 0', () => {
    expect(normalizeWeights([
      { id: 'a', weight: 0 },
      { id: 'b', weight: 0 },
    ])).toEqual([
      { id: 'a', pct: 0 },
      { id: 'b', pct: 0 },
    ]);
  });
});

describe('hash32', () => {
  it('is deterministic and unsigned', () => {
    const h = hash32('experiment:visitor-1');
    expect(h).toBe(hash32('experiment:visitor-1'));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe('pickArm', () => {
  const arms = [
    { id: 'control', weight: 50 },
    { id: 'variant', weight: 50 },
  ];

  it('is deterministic and sticky', () => {
    const first = pickArm('exp1', arms, 'tracking-xyz');
    expect(first).not.toBeNull();
    for (let i = 0; i < 20; i++) {
      expect(pickArm('exp1', arms, 'tracking-xyz')).toBe(first);
    }
  });

  it('never picks a zero-weight arm', () => {
    const weighted = [
      { id: 'a', weight: 100 },
      { id: 'b', weight: 0 },
    ];
    for (let i = 0; i < 1000; i++) {
      expect(pickArm('exp1', weighted, `id-${i}`)?.id).toBe('a');
    }
  });

  it('returns null when all weights are 0', () => {
    expect(pickArm('exp1', [
      { id: 'a', weight: 0 },
      { id: 'b', weight: 0 },
    ], 'anyone')).toBeNull();
  });

  it('distributes roughly proportional to weight', () => {
    const split = [
      { id: 'heavy', weight: 90 },
      { id: 'light', weight: 10 },
    ];
    let heavy = 0;
    let light = 0;
    for (let i = 0; i < 1000; i++) {
      const arm = pickArm('exp1', split, `visitor-${i}`);
      if (arm?.id === 'heavy') heavy++;
      else if (arm?.id === 'light') light++;
    }
    expect(heavy + light).toBe(1000);
    expect(heavy).toBeGreaterThan(light * 3);
    expect(light).toBeGreaterThan(0);
  });
});
