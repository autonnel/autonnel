import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { samplePluginExtension } from '../../fixtures/plugin-sample/builder';

// Inject the fixture as the active builder extension so the REAL registry merges it.
function mockVirtual(extensions: unknown[]) {
  vi.doMock('virtual:autonnel/builder-ext', () => ({ builderExtensions: extensions }));
}

describe('registry merges plugin templates (through the virtual module)', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.doUnmock('virtual:autonnel/builder-ext');
    vi.resetModules();
  });

  it('getTemplateData resolves a plugin data-form template', async () => {
    mockVirtual([samplePluginExtension]);
    const { getTemplateData } = await import('@/lib/templates/registry');
    const data = getTemplateData('sample:lp-static');
    expect(data.content[0]).toMatchObject({
      type: 'sample:Static',
      props: { heading: 'From Template' },
    });
  });

  it('getTemplateData resolves a plugin generator-form template', async () => {
    mockVirtual([samplePluginExtension]);
    const { getTemplateData } = await import('@/lib/templates/registry');
    const data = getTemplateData('sample:lp-generated');
    expect(data.content[0]).toMatchObject({ type: 'sample:Interactive' });
  });

  it('getTemplatesBySection includes plugin templates', async () => {
    mockVirtual([samplePluginExtension]);
    const { getTemplatesBySection } = await import('@/lib/templates/registry');
    const funnel = getTemplatesBySection('funnel').map((t) => t.value);
    expect(funnel).toContain('sample:lp-static');
    expect(funnel).toContain('sample:lp-generated');
  });

  it('zero plugins -> getTemplateData behaves exactly as today (core + EMPTY_DATA)', async () => {
    mockVirtual([]);
    const { getTemplateData, getTemplateByValue } = await import('@/lib/templates/registry');
    expect(getTemplateByValue('sample:lp-static')).toBeUndefined();
    const unknown = getTemplateData('__nope__');
    expect(unknown).toEqual({ root: { props: {} }, content: [], zones: {} });
    // A built-in template still resolves
    expect(getTemplateData('LP_SKINCARE').content.length).toBeGreaterThan(0);
  });
});
