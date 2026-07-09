import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mergePuckComponents,
  mergeCategories,
  mergeIslandLoaders,
  mergeInteractiveSet,
  collectComponentSchemas,
} from '@/components/builder/merge-extensions';
import { generateBuilderExtModuleSource } from '@/integration/builder-ext-virtual';
import { samplePluginExtension } from '../../fixtures/plugin-sample/builder';
import type { AutonnelPlugin, BuilderExtension } from '@/lib/plugins/types';

const coreComponents = {
  HeroPanel: { render: () => null },
} as never;

const coreCategories = {
  common: { title: 'Common', defaultExpanded: false, components: ['HeroPanel'] },
} as Record<string, { title?: string; defaultExpanded?: boolean; components: string[] }>;

const coreLoaders = {
  CountdownTimer: async () => (() => null) as never,
};

const coreInteractive = new Set<string>(['CountdownTimer']);

describe('merge functions — zero-extension identity', () => {
  it('mergePuckComponents([]) returns the core value unchanged', () => {
    expect(mergePuckComponents(coreComponents, [])).toBe(coreComponents);
  });
  it('mergeCategories([]) returns the core value unchanged', () => {
    expect(mergeCategories(coreCategories, [])).toBe(coreCategories);
  });
  it('mergeIslandLoaders([]) returns the core value unchanged', () => {
    expect(mergeIslandLoaders(coreLoaders, [])).toBe(coreLoaders);
  });
  it('mergeInteractiveSet([]) returns the core value unchanged', () => {
    expect(mergeInteractiveSet(coreInteractive, [])).toBe(coreInteractive);
  });
  it('an extension with no puckComponents is identity', () => {
    const empty: BuilderExtension = { name: 'noop' };
    expect(mergePuckComponents(coreComponents, [empty])).toBe(coreComponents);
    expect(mergeIslandLoaders(coreLoaders, [empty])).toBe(coreLoaders);
    expect(mergeInteractiveSet(coreInteractive, [empty])).toBe(coreInteractive);
  });
});

describe('merge functions — with the fixture', () => {
  const exts = [samplePluginExtension];

  it('mergePuckComponents adds exactly the plugin keys and keeps core', () => {
    const merged = mergePuckComponents(coreComponents, exts) as Record<string, unknown>;
    expect(Object.keys(merged).sort()).toEqual(['HeroPanel', 'sample:Interactive', 'sample:Static']);
    expect(merged['HeroPanel']).toBe((coreComponents as Record<string, unknown>)['HeroPanel']);
  });

  it('mergeCategories appends each component under its category (creating it)', () => {
    const merged = mergeCategories(coreCategories, exts);
    expect(merged.common.components).toEqual(['HeroPanel']);
    expect(merged.Sample.components).toEqual(['sample:Static']);
    // No explicit category -> falls back to the plugin name ('sample')
    expect(merged.sample.components).toEqual(['sample:Interactive']);
  });

  it('mergeIslandLoaders and mergeInteractiveSet agree (set === keys with load)', () => {
    const loaders = mergeIslandLoaders(coreLoaders, exts);
    const set = mergeInteractiveSet(coreInteractive, exts);
    expect(Object.keys(loaders).sort()).toEqual(['CountdownTimer', 'sample:Interactive']);
    expect([...set].sort()).toEqual(['CountdownTimer', 'sample:Interactive']);
    // the static component has no load -> absent from both
    expect(loaders['sample:Static']).toBeUndefined();
    expect(set.has('sample:Static')).toBe(false);
  });

  it('collectComponentSchemas applies the default schema when absent', () => {
    const schemas = collectComponentSchemas(exts);
    const byType = Object.fromEntries(schemas.map((s) => [s.type, s]));
    expect(byType['sample:Static']).toEqual({
      type: 'sample:Static',
      allowedZones: ['root'],
      requiredProps: ['heading'],
    });
    // Interactive declares no schema -> default
    expect(byType['sample:Interactive']).toEqual({
      type: 'sample:Interactive',
      allowedZones: ['root'],
      requiredProps: [],
    });
  });
});

describe('mergePuckComponents — collision: core wins + warns', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('keeps the core component and logs a warning on key collision', async () => {
    const warn = vi.fn();
    vi.doMock('@/lib/logger', () => ({ createLogger: () => ({ warn, info: () => {}, error: () => {}, debug: () => {} }) }));
    vi.resetModules();
    const { mergePuckComponents: merge } = await import('@/components/builder/merge-extensions');

    const core = { 'sample:Static': { render: () => null } } as never;
    const colliding: BuilderExtension = {
      name: 'evil',
      puckComponents: {
        'sample:Static': { config: { render: (() => null) as never } },
      },
    };
    const merged = merge(core, [colliding]) as Record<string, unknown>;
    expect(merged['sample:Static']).toBe((core as Record<string, unknown>)['sample:Static']);
    expect(warn).toHaveBeenCalledOnce();
    vi.doUnmock('@/lib/logger');
    vi.resetModules();
  });
});

describe('generateBuilderExtModuleSource', () => {
  const plugin = (name: string, builderEntry?: string): AutonnelPlugin => ({ name, version: '1.0.0', builderEntry });

  it('empty -> exact baseline string (byte-for-byte)', () => {
    expect(generateBuilderExtModuleSource([])).toBe('export const builderExtensions = [];\n');
  });

  it('plugins without builderEntry are skipped -> baseline', () => {
    expect(generateBuilderExtModuleSource([plugin('a'), plugin('b')])).toBe(
      'export const builderExtensions = [];\n',
    );
  });

  it('one builderEntry -> single named re-export', () => {
    expect(generateBuilderExtModuleSource([plugin('a', '@autonnel/theme-bold/builder')])).toBe(
      'import { builderExtension as p0 } from "@autonnel/theme-bold/builder";\n' +
        'export const builderExtensions = [p0].filter(Boolean);\n',
    );
  });

  it('two builderEntry -> two imports in order', () => {
    expect(
      generateBuilderExtModuleSource([
        plugin('a', '@autonnel/theme-bold/builder'),
        plugin('b', '@autonnel/plugin-foo/builder'),
      ]),
    ).toBe(
      'import { builderExtension as p0 } from "@autonnel/theme-bold/builder";\n' +
        'import { builderExtension as p1 } from "@autonnel/plugin-foo/builder";\n' +
        'export const builderExtensions = [p0, p1].filter(Boolean);\n',
    );
  });
});

// Closes the gap the standalone dev config hand-wired around: a pack that exports only
// `builderExtension` (the canonical contract) must flow through merge via the integration's
// virtual module. `builderExtensions = [builderExtension]` is exactly what the generated
// source yields; here we import that named export and prove it merges.
describe('integration path: the imported `builderExtension` object merges', () => {
  it('templates + components from the named export are picked up', async () => {
    const { builderExtension } = await import('../../fixtures/plugin-sample/builder');
    const { mergeTemplates, mergePuckComponents } = await import('@/components/builder/merge-extensions');
    const builderExtensions = [builderExtension];

    const templates = mergeTemplates([], builderExtensions);
    expect(templates.map((t) => t.value)).toEqual(['sample:lp-static', 'sample:lp-generated']);

    const components = mergePuckComponents({} as never, builderExtensions) as Record<string, unknown>;
    expect(Object.keys(components).sort()).toEqual(['sample:Interactive', 'sample:Static']);
  });
});
