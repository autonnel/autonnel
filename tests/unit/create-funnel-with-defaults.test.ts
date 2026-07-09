import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    pages: [] as Array<{ id: string; slug: string; type: string }>,
    addedSteps: [] as Array<{ funnelId: string; stepSlug: string; pageId: string }>,
    createdPages: [] as Array<{ name: string; slug: string; type: string; status?: string }>,
    funnelCreate: vi.fn(),
    pageCreate: vi.fn(),
  },
}));

const prismaMock = {
  page: {
    findFirst: vi.fn(async (args: any) => {
      const types: string[] = args?.where?.type?.in ?? [];
      if (args?.where?.slug !== undefined) {
        return state.pages.find((p) => p.slug === args.where.slug) ?? null;
      }
      return state.pages.find((p) => types.includes(p.type)) ?? null;
    }),
  },
};

vi.mock('@/modules/platform/infra/prisma-tenant-extension', () => ({
  getTenantPrisma: () => prismaMock,
}));

vi.mock('@/composition/make-funnel-dashboard', () => ({
  makeFunnelDashboard: () => ({
    funnels: {
      create: state.funnelCreate.mockImplementation(async (input: any) => ({
        id: 'funnel-1',
        name: input.name,
        description: input.description ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  }),
}));

vi.mock('@/composition/authoring-runtime', () => ({
  authoringDepsFromLocals: () => ({}),
}));

vi.mock('@/composition/make-authoring', () => ({
  makeAuthoring: () => ({
    pageDashboard: {
      create: state.pageCreate.mockImplementation(async (input: any) => {
        const row = { id: `page-${input.type}`, slug: input.slug, type: input.type.toUpperCase(), status: input.status };
        state.pages.push(row);
        state.createdPages.push(input);
        return row;
      }),
    },
    funnelComposing: {
      addStep: async (input: any) => {
        state.addedSteps.push(input);
      },
    },
  }),
}));

vi.mock('@/lib/templates/registry', () => ({
  getTemplateData: (value: string) => ({ root: { props: {} }, content: [], zones: {}, _template: value }),
}));

import { createFunnelWithDefaults } from '@/composition/create-funnel-with-defaults';

beforeEach(() => {
  state.pages = [];
  state.addedSteps = [];
  state.createdPages = [];
  state.funnelCreate.mockClear();
  state.pageCreate.mockClear();
  prismaMock.page.findFirst.mockClear();
});

describe('createFunnelWithDefaults', () => {
  it('creates the funnel and binds a thankyou step and an error step', async () => {
    const funnel = await createFunnelWithDefaults({ name: 'My Funnel' });

    expect(funnel.id).toBe('funnel-1');
    expect(funnel.name).toBe('My Funnel');

    expect(state.addedSteps).toHaveLength(2);
    const boundTypes = state.addedSteps.map(
      (s) => state.pages.find((p) => p.id === s.pageId)?.type,
    );
    expect(boundTypes).toContain('THANKYOU');
    expect(boundTypes).toContain('ERROR');

    // thankyou is bound before error
    expect(boundTypes[0]).toBe('THANKYOU');
    expect(boundTypes[1]).toBe('ERROR');
  });

  it('seeds default pages as PUBLISHED with template content', async () => {
    await createFunnelWithDefaults({ name: 'My Funnel' });

    expect(state.createdPages).toHaveLength(2);
    for (const created of state.createdPages) {
      expect(created.status).toBe('PUBLISHED');
      expect((created as any).publishedData).toBeTruthy();
      expect((created as any).draftData).toBeTruthy();
    }
  });

  it('reuses existing thankyou/error pages instead of creating duplicates', async () => {
    state.pages.push({ id: 'existing-ty', slug: 'thanks', type: 'THANKYOU' });
    state.pages.push({ id: 'existing-err', slug: 'oops', type: 'ERROR' });

    await createFunnelWithDefaults({ name: 'Reuse Funnel' });

    expect(state.createdPages).toHaveLength(0);
    expect(state.addedSteps.map((s) => s.pageId).sort()).toEqual(['existing-err', 'existing-ty']);
    expect(state.addedSteps.find((s) => s.pageId === 'existing-ty')!.stepSlug).toBe('thanks');
  });
});
