import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mergeTemplates,
  resolvePluginTemplateData,
  validateTemplateRequires,
} from '@/components/builder/merge-extensions';
import { samplePluginExtension, sampleTemplates } from '../../fixtures/plugin-sample/builder';
import type { BuilderExtension, PluginTemplate } from '@/lib/plugins/types';
import type { TemplateDescriptor } from '@/lib/templates/types';

const core: TemplateDescriptor[] = [
  { value: 'CORE_A', label: 'Core A', subtitle: 'a', section: 'funnel', thumbnail: null, defaultPageType: 'CUSTOM', generator: () => ({ root: { props: {} }, content: [], zones: {} }) },
  { value: 'CORE_B', label: 'Core B', subtitle: 'b', section: 'utility', thumbnail: null, defaultPageType: 'ERROR', generator: () => ({ root: { props: {} }, content: [], zones: {} }) },
];

describe('mergeTemplates — zero-extension identity', () => {
  it('returns the core registry unchanged by reference', () => {
    expect(mergeTemplates(core, [])).toBe(core);
  });
  it('an extension with no templates is identity', () => {
    expect(mergeTemplates(core, [{ name: 'noop' }])).toBe(core);
  });
});

describe('mergeTemplates — with the fixture', () => {
  const exts = [samplePluginExtension];

  it('appends plugin templates after core with mapped fields', () => {
    const merged = mergeTemplates(core, exts);
    expect(merged.length).toBe(core.length + 2);
    const staticTpl = merged.find((t) => t.value === 'sample:lp-static')!;
    expect(staticTpl).toMatchObject({
      value: 'sample:lp-static',
      label: 'Sample Landing (static)',
      subtitle: 'Driven by static data',
      section: 'funnel',
      defaultPageType: 'CUSTOM',
      defaultSlug: 'sample-lp',
      thumbnail: '/sample-thumb.png',
    });
    // The generated form has no subtitle/thumbnail -> mapped to '' / null
    const genTpl = merged.find((t) => t.value === 'sample:lp-generated')!;
    expect(genTpl.subtitle).toBe('');
    expect(genTpl.thumbnail).toBeNull();
  });

  it('the data-form template resolves to its static snapshot via the mapped generator', () => {
    const merged = mergeTemplates(core, exts);
    const tpl = merged.find((t) => t.value === 'sample:lp-static')!;
    const data = tpl.generator();
    expect(data.content[0]).toMatchObject({
      type: 'sample:Static',
      props: { heading: 'From Template', tone: 'bold' },
    });
  });

  it('the generator-form template resolves by invoking the generator', () => {
    const merged = mergeTemplates(core, exts);
    const tpl = merged.find((t) => t.value === 'sample:lp-generated')!;
    const data = tpl.generator();
    expect(data.content[0]).toMatchObject({
      type: 'sample:Interactive',
      props: { buttonLabel: 'Generated' },
    });
  });
});

describe('mergeTemplates — collision: core wins + warns', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('keeps the core template and logs a warning on value collision', async () => {
    const warn = vi.fn();
    vi.doMock('@/lib/logger', () => ({ createLogger: () => ({ warn, info() {}, error() {}, debug() {} }) }));
    vi.resetModules();
    const { mergeTemplates: merge } = await import('@/components/builder/merge-extensions');

    const coreOne: TemplateDescriptor[] = [
      { value: 'X', label: 'Core X', subtitle: '', section: 'funnel', thumbnail: null, defaultPageType: 'CUSTOM', generator: () => ({ root: { props: {} }, content: [], zones: {} }) },
    ];
    const colliding: BuilderExtension = {
      name: 'evil',
      templates: [{ value: 'X', label: 'Plugin X', section: 'funnel', defaultPageType: 'CUSTOM', data: { root: { props: {} }, content: [], zones: {} } }],
    };
    const merged = merge(coreOne, [colliding]);
    expect(merged).toHaveLength(1);
    expect(merged[0].label).toBe('Core X');
    expect(warn).toHaveBeenCalledOnce();
    vi.doUnmock('@/lib/logger');
    vi.resetModules();
  });
});

describe('mergeTemplates — invalid template skipped + warned', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('skips a template that has neither data nor generator', async () => {
    const warn = vi.fn();
    vi.doMock('@/lib/logger', () => ({ createLogger: () => ({ warn, info() {}, error() {}, debug() {} }) }));
    vi.resetModules();
    const { mergeTemplates: merge } = await import('@/components/builder/merge-extensions');

    const bad: BuilderExtension = {
      name: 'bad',
      templates: [{ value: 'sample:broken', label: 'Broken', section: 'funnel', defaultPageType: 'CUSTOM' } as PluginTemplate],
    };
    const merged = merge([], [bad]);
    expect(merged).toHaveLength(0);
    expect(warn).toHaveBeenCalledOnce();
    vi.doUnmock('@/lib/logger');
    vi.resetModules();
  });

  it('skips a template that supplies BOTH data and generator', () => {
    const both: BuilderExtension = {
      name: 'both',
      templates: [{
        value: 'sample:both',
        label: 'Both',
        section: 'funnel',
        defaultPageType: 'CUSTOM',
        data: { root: { props: {} }, content: [], zones: {} },
        generator: () => ({ root: { props: {} }, content: [], zones: {} }),
      }],
    };
    expect(mergeTemplates([], [both])).toHaveLength(0);
  });
});

describe('resolvePluginTemplateData', () => {
  it('returns data when present', () => {
    const d = resolvePluginTemplateData(sampleTemplates[0]);
    expect(d.content[0]).toMatchObject({ type: 'sample:Static' });
  });
  it('invokes generator when data absent', () => {
    const d = resolvePluginTemplateData(sampleTemplates[1]);
    expect(d.content[0]).toMatchObject({ type: 'sample:Interactive' });
  });
});

describe('validateTemplateRequires', () => {
  it('returns no problems when every requires[] type is registered', () => {
    const registered = new Set(['sample:Static', 'sample:Interactive']);
    expect(validateTemplateRequires(sampleTemplates, registered)).toEqual([]);
  });

  it('reports each unsatisfied requires[] type with a human-readable message', () => {
    const registered = new Set(['sample:Static']); // sample:Interactive missing
    const problems = validateTemplateRequires(sampleTemplates, registered);
    expect(problems).toEqual([
      'Template "sample:lp-generated" requires "sample:Interactive" (no active plugin/core component provides it)',
    ]);
  });
});
