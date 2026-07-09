import { describe, it, expect, vi } from 'vitest';
import { ManageFunnelsService, FunnelNotFoundError } from './manage-funnels.service';
import { ManageFunnelScriptsService, FunnelScriptNotFoundError } from './manage-funnel-scripts.service';
import {
  ManageExperimentService,
  ExperimentNotFoundError,
  ExperimentExistsError,
} from './manage-experiment.service';
import { FunnelScript } from '../domain/funnel-script';
import { Experiment, ExperimentArm } from '../domain/experiment';
import type { FunnelRepository, FunnelScriptRepository, ExperimentRepository, ExperimentWithArms } from './ports';

const summary = { id: 'f1', name: 'A', description: null, createdAt: new Date(), updatedAt: new Date() };

describe('ManageFunnelsService', () => {
  it('create trims and requires a name', async () => {
    const repo = { create: vi.fn().mockResolvedValue(summary) } as unknown as FunnelRepository;
    const svc = new ManageFunnelsService(repo);
    await expect(svc.create({ name: '   ' })).rejects.toThrow('Name is required');
    await svc.create({ name: '  Promo  ', description: ' hi ' });
    expect(repo.create).toHaveBeenCalledWith({ name: 'Promo', description: 'hi' });
  });

  it('update rejects empty name and requires a field', async () => {
    const repo = { update: vi.fn() } as unknown as FunnelRepository;
    const svc = new ManageFunnelsService(repo);
    await expect(svc.update('f1', { name: ' ' })).rejects.toThrow('name cannot be empty');
    await expect(svc.update('f1', {})).rejects.toThrow(/At least one/);
  });

  it('remove throws when not found', async () => {
    const repo = { delete: vi.fn().mockResolvedValue(false) } as unknown as FunnelRepository;
    await expect(new ManageFunnelsService(repo).remove('x')).rejects.toBeInstanceOf(FunnelNotFoundError);
  });

  it('duplicate copies under "(Copy)" name and forwards the clonePages option', async () => {
    const copy = { ...summary, id: 'f2', name: 'A (Copy)' };
    const repo = {
      findById: vi.fn().mockResolvedValue(summary),
      duplicate: vi.fn().mockResolvedValue(copy),
    } as unknown as FunnelRepository;
    const out = await new ManageFunnelsService(repo).duplicate('f1', { clonePages: true });
    expect(repo.duplicate).toHaveBeenCalledWith('f1', 'A (Copy)', { clonePages: true });
    expect(out.name).toBe('A (Copy)');
  });
});

describe('ManageFunnelScriptsService', () => {
  it('update throws when missing', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(null) } as unknown as FunnelScriptRepository;
    await expect(new ManageFunnelScriptsService(repo).update('s1', { name: 'x' })).rejects.toBeInstanceOf(
      FunnelScriptNotFoundError,
    );
  });

  it('update loads, edits, saves', async () => {
    const existing = FunnelScript.rehydrate({ id: 's1', funnelId: 'f1', name: 'GA', content: 'c', position: 'HEAD', isActive: true, order: 0 });
    const repo = {
      findById: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockImplementation((s: FunnelScript) => Promise.resolve(s)),
    } as unknown as FunnelScriptRepository;
    const out = await new ManageFunnelScriptsService(repo).update('s1', { name: 'Pixel' });
    expect(out.name).toBe('Pixel');
  });
});

describe('ManageExperimentService', () => {
  function rehydrate(over: Partial<{ id: string; status: 'draft' | 'running' | 'concluded'; winnerArmId: string | null }> = {}): Experiment {
    return Experiment.rehydrate({
      id: over.id ?? 'e1',
      tenantId: 't',
      funnelId: 'f1',
      name: 'Test',
      status: over.status ?? 'draft',
      goal: { kind: 'order' },
      winnerArmId: over.winnerArmId ?? null,
    });
  }

  function arm(id: string, over: Partial<{ isControl: boolean; weight: number }> = {}): ExperimentArm {
    return ExperimentArm.rehydrate({
      id,
      experimentId: 'e1',
      name: id,
      weight: over.weight ?? 50,
      isControl: over.isControl ?? false,
      targetFunnelId: 'f1',
      targetPageId: null,
      order: 0,
    });
  }

  function withArms(experiment: Experiment, arms: ExperimentArm[]): ExperimentWithArms {
    return { experiment, arms, labels: {} };
  }

  it('create rejects a second experiment for the same funnel', async () => {
    const repo = {
      findExperimentIdByFunnel: vi.fn().mockResolvedValue('e1'),
    } as unknown as ExperimentRepository;
    await expect(
      new ManageExperimentService(repo).create('f1', { name: 'X', goal: { kind: 'order' } }),
    ).rejects.toBeInstanceOf(ExperimentExistsError);
  });

  it('create seeds a control and a variant arm at weight 50', async () => {
    const exp = rehydrate();
    const repo = {
      findExperimentIdByFunnel: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(withArms(exp, [])),
      addArm: vi.fn().mockResolvedValue(withArms(exp, [arm('a', { isControl: true }), arm('b')])),
    } as unknown as ExperimentRepository;
    const out = await new ManageExperimentService(repo).create('f1', { name: 'X', goal: { kind: 'order' } });
    expect(repo.addArm).toHaveBeenCalledTimes(2);
    const first = (repo.addArm as ReturnType<typeof vi.fn>).mock.calls[0][0] as ExperimentArm;
    const second = (repo.addArm as ReturnType<typeof vi.fn>).mock.calls[1][0] as ExperimentArm;
    expect(first.isControl).toBe(true);
    expect(first.name).toBe('Control');
    expect(first.weight).toBe(50);
    expect(second.isControl).toBe(false);
    expect(second.weight).toBe(50);
    expect(out.arms).toHaveLength(2);
  });

  it('update throws when no experiment exists', async () => {
    const repo = { findByFunnel: vi.fn().mockResolvedValue(null) } as unknown as ExperimentRepository;
    await expect(new ManageExperimentService(repo).update('f1', { name: 'Y' })).rejects.toBeInstanceOf(
      ExperimentNotFoundError,
    );
  });

  it('update edits name/goal and persists', async () => {
    const exp = rehydrate();
    const repo = {
      findByFunnel: vi.fn().mockResolvedValue(withArms(exp, [arm('a')])),
      updateExperiment: vi.fn().mockImplementation((e: Experiment) => Promise.resolve(withArms(e, [arm('a')]))),
    } as unknown as ExperimentRepository;
    const out = await new ManageExperimentService(repo).update('f1', { name: 'Renamed', goal: { kind: 'step_reached', stepId: 's' } });
    expect(out.experiment.name).toBe('Renamed');
    expect(out.experiment.goal).toEqual({ kind: 'step_reached', stepId: 's' });
  });

  it('action start moves draft to running', async () => {
    const exp = rehydrate({ status: 'draft' });
    const repo = {
      findByFunnel: vi.fn().mockResolvedValue(withArms(exp, [arm('a')])),
      updateExperiment: vi.fn().mockImplementation((e: Experiment) => Promise.resolve(withArms(e, [arm('a')]))),
    } as unknown as ExperimentRepository;
    const out = await new ManageExperimentService(repo).update('f1', { action: 'start' });
    expect(out.experiment.status).toBe('running');
  });

  it('action conclude requires a winnerArmId and sets the winner', async () => {
    const exp = rehydrate({ status: 'running' });
    const arms = [arm('a'), arm('b')];
    const repo = {
      findByFunnel: vi.fn().mockResolvedValue(withArms(exp, arms)),
      updateExperiment: vi.fn().mockImplementation((e: Experiment) => Promise.resolve(withArms(e, arms))),
    } as unknown as ExperimentRepository;
    const svc = new ManageExperimentService(repo);
    await expect(svc.update('f1', { action: 'conclude' })).rejects.toThrow(/winnerArmId/);
    const out = await svc.update('f1', { action: 'conclude', winnerArmId: 'b' });
    expect(out.experiment.status).toBe('concluded');
    expect(out.experiment.winnerArmId).toBe('b');
  });

  it('addArm uses next order and delegates to repo', async () => {
    const exp = rehydrate();
    const existing = [arm('a')];
    existing[0].order = 3;
    const repo = {
      findByFunnel: vi.fn().mockResolvedValue(withArms(exp, existing)),
      addArm: vi.fn().mockImplementation((a: ExperimentArm) => Promise.resolve(withArms(exp, [...existing, a]))),
    } as unknown as ExperimentRepository;
    await new ManageExperimentService(repo).addArm('f1', { name: 'C', weight: 20, targetPageId: 'p1' });
    const added = (repo.addArm as ReturnType<typeof vi.fn>).mock.calls[0][0] as ExperimentArm;
    expect(added.order).toBe(4);
    expect(added.targetPageId).toBe('p1');
  });

  it('updateArm edits an existing arm', async () => {
    const exp = rehydrate();
    const arms = [arm('a', { weight: 10 })];
    const repo = {
      findByFunnel: vi.fn().mockResolvedValue(withArms(exp, arms)),
      updateArm: vi.fn().mockImplementation((a: ExperimentArm) => Promise.resolve(withArms(exp, [a]))),
    } as unknown as ExperimentRepository;
    const out = await new ManageExperimentService(repo).updateArm('f1', { armId: 'a', weight: 80 });
    expect(out.arms[0].weight).toBe(80);
  });

  it('removeArm throws when the arm is not part of the experiment', async () => {
    const exp = rehydrate();
    const repo = {
      findByFunnel: vi.fn().mockResolvedValue(withArms(exp, [arm('a')])),
      deleteArm: vi.fn(),
    } as unknown as ExperimentRepository;
    await expect(new ManageExperimentService(repo).removeArm('f1', 'missing')).rejects.toBeInstanceOf(
      ExperimentNotFoundError,
    );
  });

  it('remove deletes by resolved experiment id', async () => {
    const repo = {
      findExperimentIdByFunnel: vi.fn().mockResolvedValue('e1'),
      deleteExperiment: vi.fn().mockResolvedValue(undefined),
    } as unknown as ExperimentRepository;
    await new ManageExperimentService(repo).remove('f1');
    expect(repo.deleteExperiment).toHaveBeenCalledWith('e1');
  });
});
