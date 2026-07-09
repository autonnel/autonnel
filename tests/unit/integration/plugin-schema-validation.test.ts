import { describe, it, expect } from 'vitest';
import { InProcessComponentSchemaRegistry } from '@/modules/platform/infra/registries';
import { PluginComponentSchemaResolver } from '@/modules/authoring/infra/plugin-component-schema';
import { PageValidator } from '@/modules/authoring/domain/services/page-validator';
import { collectComponentSchemas } from '@/components/builder/merge-extensions';
import { BUILT_IN_COMPONENT_SCHEMAS } from '@/components/builder/built-in-schemas';
import { samplePluginExtension } from '../../fixtures/plugin-sample/builder';
import type { PuckDocument } from '@/modules/authoring/domain/value-objects/puck-document';

// Mirrors the request-time path: a fresh registry is populated with built-in + plugin
// schemas, then PluginComponentSchemaResolver feeds PageValidator. Fresh per test (no
// shared globalThis singleton) so registration never leaks across cases.
async function validatorAccepting(): Promise<{ ok: boolean; issues: string[] }> {
  const registry = new InProcessComponentSchemaRegistry();
  for (const s of BUILT_IN_COMPONENT_SCHEMAS) registry.register(s);
  for (const s of collectComponentSchemas([samplePluginExtension])) registry.register(s);

  const resolver = new PluginComponentSchemaResolver(registry);
  const schemas = await resolver.listSchemas();

  const doc: PuckDocument = {
    root: { props: {} },
    content: [{ type: 'sample:Static', props: { id: 's1', heading: 'present' } }],
    zones: {},
  } as unknown as PuckDocument;

  return new PageValidator().validate(doc, schemas, { bindings: [], validRefs: new Set() });
}

describe('plugin component schema is honored by PageValidator', () => {
  it('accepts a page that uses the registered plugin component type', async () => {
    const result = await validatorAccepting();
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects an unregistered component type', () => {
    const registry = new InProcessComponentSchemaRegistry();
    const resolver = new PluginComponentSchemaResolver(registry);
    const doc = {
      root: { props: {} },
      content: [{ type: 'sample:Static', props: { id: 's1', heading: 'present' } }],
      zones: {},
    } as unknown as PuckDocument;
    return resolver.listSchemas().then((schemas) => {
      const result = new PageValidator().validate(doc, schemas, { bindings: [], validRefs: new Set() });
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes('unregistered'))).toBe(true);
    });
  });

  it('enforces the plugin requiredProps (missing heading fails)', async () => {
    const registry = new InProcessComponentSchemaRegistry();
    for (const s of collectComponentSchemas([samplePluginExtension])) registry.register(s);
    const resolver = new PluginComponentSchemaResolver(registry);
    const schemas = await resolver.listSchemas();
    const doc = {
      root: { props: {} },
      content: [{ type: 'sample:Static', props: { id: 's1' } }],
      zones: {},
    } as unknown as PuckDocument;
    const result = new PageValidator().validate(doc, schemas, { bindings: [], validRefs: new Set() });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes('heading'))).toBe(true);
  });
});
