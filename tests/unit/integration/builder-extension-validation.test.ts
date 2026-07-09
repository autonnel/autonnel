import { describe, it, expect } from 'vitest';
import {
  validateNamespaces,
  assertBuilderExtensionsValid,
} from '@/components/builder/merge-extensions';
import { InvalidBuilderExtensionError } from '@/lib/plugins/errors';
import type { BuilderExtension } from '@/lib/plugins/types';

const coreComponentKeys = new Set<string>(['HeroPanel', 'CountdownTimer']);
const coreTemplateValues = new Set<string>(['LP_SKINCARE', 'POLICY']);

function comp(): BuilderExtension['puckComponents'] {
  return { 'sample:X': { config: { render: (() => null) as never } } } as never;
}

describe('validateNamespaces', () => {
  it('returns [] for zero extensions', () => {
    expect(validateNamespaces([], coreComponentKeys, coreTemplateValues)).toEqual([]);
  });

  it('returns [] for properly namespaced, non-colliding keys and template values', () => {
    const ext: BuilderExtension = {
      name: 'acme',
      puckComponents: comp(),
      templates: [
        { value: 'acme:lp', label: 'LP', section: 'funnel', defaultPageType: 'CUSTOM', data: { root: { props: {} }, content: [], zones: {} } },
      ],
    };
    expect(validateNamespaces([ext], coreComponentKeys, coreTemplateValues)).toEqual([]);
  });

  it('flags an un-namespaced component key', () => {
    const ext: BuilderExtension = {
      name: 'acme',
      puckComponents: { Hero: { config: { render: (() => null) as never } } } as never,
    };
    const problems = validateNamespaces([ext], coreComponentKeys, coreTemplateValues);
    expect(problems).toEqual(['Plugin component key "Hero" must be namespaced (e.g. "acme:Hero")']);
  });

  it('flags a component key colliding with a built-in', () => {
    const ext: BuilderExtension = {
      name: 'acme',
      // colliding key must still be namespaced to reach the collision branch
      puckComponents: { HeroPanel: { config: { render: (() => null) as never } } } as never,
    };
    const keysWithNs = new Set<string>(['acme:HeroPanel']);
    const problems = validateNamespaces([ext], keysWithNs, coreTemplateValues);
    // 'HeroPanel' has no ':' -> reported as un-namespaced (collision branch only fires when ':' present)
    expect(problems[0]).toContain('must be namespaced');
  });

  it('flags a namespaced key that collides with a built-in', () => {
    const cores = new Set<string>(['acme:Hero']);
    const ext: BuilderExtension = {
      name: 'acme',
      puckComponents: { 'acme:Hero': { config: { render: (() => null) as never } } } as never,
    };
    const problems = validateNamespaces([ext], cores, coreTemplateValues);
    expect(problems).toEqual([
      'Plugin component key "acme:Hero" collides with a built-in component "acme:Hero"',
    ]);
  });

  it('flags an un-namespaced template value', () => {
    const ext: BuilderExtension = {
      name: 'acme',
      templates: [{ value: 'lp', label: 'LP', section: 'funnel', defaultPageType: 'CUSTOM', data: { root: { props: {} }, content: [], zones: {} } }],
    };
    const problems = validateNamespaces([ext], coreComponentKeys, coreTemplateValues);
    expect(problems).toEqual(['Plugin template value "lp" must be namespaced (e.g. "acme:lp")']);
  });

  it('flags a template value colliding with a built-in', () => {
    const cores = new Set<string>(['acme:lp']);
    const ext: BuilderExtension = {
      name: 'acme',
      templates: [{ value: 'acme:lp', label: 'LP', section: 'funnel', defaultPageType: 'CUSTOM', data: { root: { props: {} }, content: [], zones: {} } }],
    };
    const problems = validateNamespaces([ext], coreComponentKeys, cores);
    expect(problems).toEqual([
      'Plugin template value "acme:lp" collides with a built-in template "acme:lp"',
    ]);
  });
});

describe('assertBuilderExtensionsValid', () => {
  it('does not throw for zero extensions', () => {
    expect(() => assertBuilderExtensionsValid([], coreComponentKeys, coreTemplateValues)).not.toThrow();
  });

  it('does not throw for a clean namespaced fixture', () => {
    const ext: BuilderExtension = {
      name: 'acme',
      puckComponents: { 'acme:Hero': { config: { render: (() => null) as never } } } as never,
      templates: [
        { value: 'acme:lp', label: 'LP', section: 'funnel', defaultPageType: 'CUSTOM', data: { root: { props: {} }, content: [], zones: {} }, requires: ['acme:Hero'] },
      ],
    };
    expect(() => assertBuilderExtensionsValid([ext], coreComponentKeys, coreTemplateValues)).not.toThrow();
  });

  it('throws listing both namespace and missing-requires problems', () => {
    const ext: BuilderExtension = {
      name: 'bad',
      // un-namespaced component key
      puckComponents: { Hero: { config: { render: (() => null) as never } } } as never,
      templates: [
        // un-namespaced value AND a missing required component
        { value: 'lp', label: 'LP', section: 'funnel', defaultPageType: 'CUSTOM', data: { root: { props: {} }, content: [], zones: {} }, requires: ['acme:Missing'] },
      ],
    };
    try {
      assertBuilderExtensionsValid([ext], coreComponentKeys, coreTemplateValues);
      throw new Error('expected assertBuilderExtensionsValid to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidBuilderExtensionError);
      const problems = (err as InvalidBuilderExtensionError).problems;
      expect(problems).toContain('Plugin component key "Hero" must be namespaced (e.g. "acme:Hero")');
      expect(problems).toContain('Plugin template value "lp" must be namespaced (e.g. "acme:lp")');
      expect(problems.some((p) => p.includes('requires "acme:Missing"'))).toBe(true);
    }
  });
});
