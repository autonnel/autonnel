import { describe, it, expect } from 'vitest';
import { assignArm } from './assign-arm';
import type { AbTestAssignmentRepository } from './ports';
import { ExperimentArm, type ExperimentStatus } from '../domain/experiment';

function arm(id: string, weight = 50, isControl = false): ExperimentArm {
  return ExperimentArm.rehydrate({
    id,
    experimentId: 'e1',
    name: id,
    weight,
    isControl,
    targetFunnelId: 'f1',
    targetPageId: null,
    order: 0,
  });
}

function loaded(status: ExperimentStatus, arms: ExperimentArm[], winnerArmId: string | null = null) {
  return { experiment: { id: 'e1', status, winnerArmId }, arms };
}

// Keeps the first assignment, mirroring the repository's P2002 keep-existing semantics.
function fakeRepo(): AbTestAssignmentRepository & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const key = (e: string, t: string) => `${e}:${t}`;
  return {
    store,
    async find(e, t) {
      return store.get(key(e, t)) ?? null;
    },
    async assign(e, t, a) {
      if (!store.has(key(e, t))) store.set(key(e, t), a);
    },
  };
}

describe('assignArm', () => {
  it('returns null for a draft experiment and persists nothing', async () => {
    const repo = fakeRepo();
    expect(await assignArm(repo, loaded('draft', [arm('a'), arm('b')]), 'v1')).toBeNull();
    expect(repo.store.size).toBe(0);
  });

  it('returns the winner arm when concluded without touching assignments', async () => {
    const repo = fakeRepo();
    const out = await assignArm(repo, loaded('concluded', [arm('a'), arm('b')], 'b'), 'v1');
    expect(out?.arm.id).toBe('b');
    expect(repo.store.size).toBe(0);
  });

  it('returns null when concluded with a missing or absent winner', async () => {
    const repo = fakeRepo();
    expect(await assignArm(repo, loaded('concluded', [arm('a')], 'ghost'), 'v1')).toBeNull();
    expect(await assignArm(repo, loaded('concluded', [arm('a')], null), 'v1')).toBeNull();
  });

  it('returns null when running with all weights at 0', async () => {
    const repo = fakeRepo();
    expect(await assignArm(repo, loaded('running', [arm('a', 0), arm('b', 0)]), 'v1')).toBeNull();
  });

  it('persists the first pick and returns the same arm on every later visit', async () => {
    const repo = fakeRepo();
    const input = loaded('running', [arm('a'), arm('b')]);
    const first = await assignArm(repo, input, 'visitor-xyz');
    expect(first).not.toBeNull();
    expect(repo.store.get('e1:visitor-xyz')).toBe(first!.arm.id);
    for (let i = 0; i < 20; i++) {
      expect((await assignArm(repo, input, 'visitor-xyz'))!.arm.id).toBe(first!.arm.id);
    }
  });

  it('keeps an already-assigned visitor on its arm after the weights change', async () => {
    const repo = fakeRepo();
    // First the split routes everyone to control (variant has zero weight).
    const before = await assignArm(repo, loaded('running', [arm('control', 100, true), arm('variant', 0)]), 'v1');
    expect(before!.arm.id).toBe('control');

    // Flip the weights so a fresh pick would now land on variant.
    const after = await assignArm(repo, loaded('running', [arm('control', 0, true), arm('variant', 100)]), 'v1');
    expect(after!.arm.id).toBe('control');
    expect(repo.store.get('e1:v1')).toBe('control');
  });

  it('routes a brand-new visitor by the current weights, not the old assignment', async () => {
    const repo = fakeRepo();
    await assignArm(repo, loaded('running', [arm('control', 100, true), arm('variant', 0)]), 'v1');
    // New weights + a visitor that was never assigned -> picks per the current split.
    const fresh = await assignArm(repo, loaded('running', [arm('control', 0, true), arm('variant', 100)]), 'v2');
    expect(fresh!.arm.id).toBe('variant');
  });

  it('re-picks a live arm when the stored assignment points at a deleted arm', async () => {
    const repo = fakeRepo();
    repo.store.set('e1:v1', 'deleted-arm');
    const out = await assignArm(repo, loaded('running', [arm('a', 100, true), arm('b', 0)]), 'v1');
    expect(out!.arm.id).toBe('a');
  });
});
