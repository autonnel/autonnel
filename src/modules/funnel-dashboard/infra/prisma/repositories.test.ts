import { describe, it, expect, vi } from 'vitest';
import { PrismaFunnelDashboardRepository } from './funnel.repository';
import { PrismaFunnelScriptRepository } from './funnel-script.repository';
import { PrismaExperimentRepository } from './experiment.repository';
import { FunnelScript } from '../../domain/funnel-script';
import { Experiment, ExperimentArm } from '../../domain/experiment';

describe('PrismaFunnelDashboardRepository', () => {
  it('maps rows to summaries', async () => {
    const now = new Date();
    const findMany = vi.fn().mockResolvedValue([
      { id: 'f1', name: 'A', description: 'd', steps: [], transitions: [], createdAt: now, updatedAt: now },
    ]);
    const repo = new PrismaFunnelDashboardRepository({ funnel: { findMany } } as never);
    const out = await repo.list();
    expect(out[0]).toEqual({ id: 'f1', name: 'A', description: 'd', createdAt: now, updatedAt: now });
  });

  it('duplicate copies steps/transitions under a new name', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'f1', name: 'A', description: 'd', steps: [{ stepSlug: 's' }], transitions: [{ from: 's' }], createdAt: new Date(), updatedAt: new Date() });
    const create = vi.fn().mockResolvedValue({ id: 'f2', name: 'A (Copy)', description: 'd', createdAt: new Date(), updatedAt: new Date() });
    const repo = new PrismaFunnelDashboardRepository({ funnel: { findFirst, create } } as never);
    const out = await repo.duplicate('f1', 'A (Copy)');
    expect(create).toHaveBeenCalledWith({
      data: { name: 'A (Copy)', description: 'd', steps: [{ stepSlug: 's' }], transitions: [{ from: 's' }] },
    });
    expect(out?.id).toBe('f2');
  });

  it('update returns null when nothing matched', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repo = new PrismaFunnelDashboardRepository({ funnel: { updateMany } } as never);
    expect(await repo.update('x', { name: 'n' })).toBeNull();
  });

  it('clonePages gives the copy its own pages and rewrites every step pageId', async () => {
    const funnelFindFirst = vi.fn().mockResolvedValue({
      id: 'f1',
      name: 'A',
      description: 'd',
      steps: [
        { stepSlug: 'lp', pageId: 'p1' },
        { stepSlug: 'co', pageId: 'p2' },
      ],
      transitions: [{ from: 'lp' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const funnelCreate = vi.fn().mockResolvedValue({ id: 'f2', name: 'A (Copy)', description: 'd', createdAt: new Date(), updatedAt: new Date() });

    const sourcePages: Record<string, { id: string; slug: string }> = {
      p1: { id: 'p1', slug: 'landing' },
      p2: { id: 'p2', slug: 'checkout' },
    };
    const pageFindFirst = vi.fn().mockImplementation(({ where }: { where: { id?: string; slug?: string } }) => {
      if (where.id) return Promise.resolve({ ...sourcePages[where.id], name: where.id, type: 'CUSTOM', editorType: 'PUCK' });
      return Promise.resolve(null); // slug-uniqueness probe: slug is free
    });
    let n = 0;
    const pageCreate = vi.fn().mockImplementation(() => Promise.resolve({ id: `clone${++n}` }));

    const repo = new PrismaFunnelDashboardRepository({
      funnel: { findFirst: funnelFindFirst, create: funnelCreate },
      page: { findFirst: pageFindFirst, create: pageCreate },
    } as never);

    const out = await repo.duplicate('f1', 'A (Copy)', { clonePages: true });
    expect(out?.id).toBe('f2');
    expect(pageCreate).toHaveBeenCalledTimes(2);

    const createdSteps = funnelCreate.mock.calls[0][0].data.steps as Array<{ stepSlug: string; pageId: string }>;
    expect(createdSteps.map((s) => s.stepSlug)).toEqual(['lp', 'co']);
    const newPageIds = createdSteps.map((s) => s.pageId);
    expect(newPageIds).toEqual(['clone1', 'clone2']);
    expect(newPageIds).not.toContain('p1');
    expect(newPageIds).not.toContain('p2');
  });

  it('clonePages clones a shared page once and points both steps at it', async () => {
    const funnelFindFirst = vi.fn().mockResolvedValue({
      id: 'f1',
      name: 'A',
      description: null,
      steps: [
        { stepSlug: 'lp', pageId: 'shared' },
        { stepSlug: 'co', pageId: 'shared' },
      ],
      transitions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const funnelCreate = vi.fn().mockResolvedValue({ id: 'f2', name: 'A (Copy)', description: null, createdAt: new Date(), updatedAt: new Date() });
    const pageFindFirst = vi.fn().mockImplementation(({ where }: { where: { id?: string; slug?: string } }) =>
      where.id ? Promise.resolve({ id: 'shared', slug: 'shared', name: 'Shared', type: 'CUSTOM', editorType: 'PUCK' }) : Promise.resolve(null),
    );
    const pageCreate = vi.fn().mockResolvedValue({ id: 'cloneShared' });

    const repo = new PrismaFunnelDashboardRepository({
      funnel: { findFirst: funnelFindFirst, create: funnelCreate },
      page: { findFirst: pageFindFirst, create: pageCreate },
    } as never);

    await repo.duplicate('f1', 'A (Copy)', { clonePages: true });
    expect(pageCreate).toHaveBeenCalledTimes(1);
    const createdSteps = funnelCreate.mock.calls[0][0].data.steps as Array<{ pageId: string }>;
    expect(createdSteps.map((s) => s.pageId)).toEqual(['cloneShared', 'cloneShared']);
  });
});

describe('PrismaFunnelScriptRepository', () => {
  it('maps create row back to FunnelScript', async () => {
    const row = { id: 's1', funnelId: 'f1', name: 'GA', content: '<s/>', position: 'HEAD', isActive: true, order: 0 };
    const create = vi.fn().mockResolvedValue(row);
    const repo = new PrismaFunnelScriptRepository({ funnelScript: { create } } as never);
    const script = FunnelScript.create({ funnelId: 'f1', name: 'GA', content: '<s/>', position: 'HEAD' });
    const saved = await repo.create(script);
    expect(saved).toBeInstanceOf(FunnelScript);
    expect(create).toHaveBeenCalledWith({
      data: { funnelId: 'f1', name: 'GA', content: '<s/>', position: 'HEAD', isActive: true, order: 0 },
    });
  });
});

describe('PrismaExperimentRepository', () => {
  const expRow = {
    id: 'e1',
    tenantId: 't',
    funnelId: 'f1',
    name: 'Test',
    status: 'draft',
    goal: { kind: 'order' },
    winnerArmId: null,
  };

  it('findByFunnel assembles arms and resolves funnel/page labels', async () => {
    const experiment = { findFirst: vi.fn().mockResolvedValue(expRow) };
    const experimentArm = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'a1', experimentId: 'e1', name: 'Control', isControl: true, weight: 50, targetFunnelId: 'f1', targetPageId: null, order: 0 },
        { id: 'a2', experimentId: 'e1', name: 'B', isControl: false, weight: 50, targetFunnelId: null, targetPageId: 'p1', order: 1 },
      ]),
    };
    const funnel = { findMany: vi.fn().mockResolvedValue([{ id: 'f1', name: 'Main funnel' }]) };
    const page = { findMany: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Landing', slug: 'landing' }]) };
    const repo = new PrismaExperimentRepository({ experiment, experimentArm, funnel, page } as never);

    const out = await repo.findByFunnel('f1');
    expect(out?.experiment).toBeInstanceOf(Experiment);
    expect(out?.arms).toHaveLength(2);
    expect(out?.arms[0]).toBeInstanceOf(ExperimentArm);
    expect(out?.labels.a1).toBe('Main funnel');
    expect(out?.labels.a2).toBe('Landing');
  });

  it('findByFunnel returns null when no experiment exists', async () => {
    const experiment = { findFirst: vi.fn().mockResolvedValue(null) };
    const repo = new PrismaExperimentRepository({ experiment } as never);
    expect(await repo.findByFunnel('f1')).toBeNull();
  });

  it('create persists a draft experiment then assembles it', async () => {
    const experiment = {
      create: vi.fn().mockResolvedValue(expRow),
      findFirst: vi.fn().mockResolvedValue(expRow),
    };
    const experimentArm = { findMany: vi.fn().mockResolvedValue([]) };
    const repo = new PrismaExperimentRepository({ experiment, experimentArm } as never);
    const out = await repo.create({ funnelId: 'f1', name: 'Test', goal: { kind: 'order' } });
    expect(experiment.create).toHaveBeenCalledWith({
      data: { funnelId: 'f1', name: 'Test', status: 'draft', goal: { kind: 'order' } },
    });
    expect(out.experiment.id).toBe('e1');
  });

  it('updateExperiment stamps startedAt only on the start transition', async () => {
    const experiment = {
      update: vi.fn().mockResolvedValue({ ...expRow, status: 'running' }),
      findFirst: vi.fn().mockResolvedValue({ ...expRow, status: 'running' }),
    };
    const experimentArm = { findMany: vi.fn().mockResolvedValue([]) };
    const repo = new PrismaExperimentRepository({ experiment, experimentArm } as never);
    const running = Experiment.rehydrate({ ...expRow, status: 'running', goal: { kind: 'order' } });
    await repo.updateExperiment(running, { justStarted: true });
    const data = experiment.update.mock.calls[0][0].data;
    expect(data.startedAt).toBeInstanceOf(Date);
    expect(data.status).toBe('running');
  });

  it('updateExperiment does not re-stamp startedAt on a mid-run edit', async () => {
    const experiment = {
      update: vi.fn().mockResolvedValue({ ...expRow, status: 'running' }),
      findFirst: vi.fn().mockResolvedValue({ ...expRow, status: 'running' }),
    };
    const experimentArm = { findMany: vi.fn().mockResolvedValue([]) };
    const repo = new PrismaExperimentRepository({ experiment, experimentArm } as never);
    const running = Experiment.rehydrate({ ...expRow, status: 'running', goal: { kind: 'order' } });
    await repo.updateExperiment(running);
    const data = experiment.update.mock.calls[0][0].data;
    expect(data.startedAt).toBeUndefined();
    expect(data.concludedAt).toBeUndefined();
  });

  it('addArm creates the arm then reassembles by experiment id', async () => {
    const experiment = { findFirst: vi.fn().mockResolvedValue(expRow) };
    const experimentArm = {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    };
    const repo = new PrismaExperimentRepository({ experiment, experimentArm } as never);
    const arm = ExperimentArm.create({ experimentId: 'e1', name: 'C', weight: 10, targetPageId: 'p2' });
    await repo.addArm(arm);
    expect(experimentArm.create).toHaveBeenCalledWith({
      data: { experimentId: 'e1', name: 'C', isControl: false, weight: 10, targetFunnelId: null, targetPageId: 'p2', order: 0 },
    });
  });
});
