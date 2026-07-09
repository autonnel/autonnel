import type { Config, Data } from '@puckeditor/core';
import type { BuilderExtension, PluginPuckComponent, PluginTemplate } from '@/lib/plugins/types';
import type { TemplateDescriptor } from '@/lib/templates/types';
import { createLogger } from '@/lib/logger';
import { InvalidBuilderExtensionError } from '@/lib/plugins/errors';

const logger = createLogger('BuilderExtensions');

type Components = Config['components'];
type Categories = Record<string, { title?: string; defaultExpanded?: boolean; components: string[] }>;
type ComponentLoader = () => Promise<import('react').ComponentType<any>>;

const DEFAULT_SCHEMA = { allowedZones: ['root'], requiredProps: [] as string[] };

function eachComponent(
  exts: BuilderExtension[],
  fn: (key: string, comp: PluginPuckComponent, ext: BuilderExtension) => void,
): void {
  for (const ext of exts) {
    if (!ext?.puckComponents) continue;
    for (const [key, comp] of Object.entries(ext.puckComponents)) fn(key, comp, ext);
  }
}

function hasAny(exts: BuilderExtension[]): boolean {
  return exts.some((e) => e?.puckComponents && Object.keys(e.puckComponents).length > 0);
}

export function mergePuckComponents(core: Components, exts: BuilderExtension[]): Components {
  if (!hasAny(exts)) return core;
  const merged: Components = { ...core };
  eachComponent(exts, (key, comp) => {
    if (key in merged) {
      logger.warn('Plugin component key collides with an existing component; core wins', { key });
      return;
    }
    (merged as Record<string, unknown>)[key] = comp.config;
  });
  return merged;
}

export function mergeCategories(core: Categories, exts: BuilderExtension[]): Categories {
  if (!hasAny(exts)) return core;
  const merged: Categories = { ...core };
  eachComponent(exts, (key, comp, ext) => {
    const category = comp.category || ext.name || 'plugin';
    const existing = merged[category];
    const components = existing ? [...existing.components] : [];
    if (!components.includes(key)) components.push(key);
    merged[category] = existing
      ? { ...existing, components }
      : { title: category, defaultExpanded: false, components };
  });
  return merged;
}

export function mergeIslandLoaders(
  core: Record<string, ComponentLoader>,
  exts: BuilderExtension[],
): Record<string, ComponentLoader> {
  if (!hasAny(exts)) return core;
  const merged: Record<string, ComponentLoader> = { ...core };
  eachComponent(exts, (key, comp) => {
    if (comp.load) merged[key] = comp.load;
  });
  return merged;
}

export function mergeInteractiveSet(core: Set<string>, exts: BuilderExtension[]): Set<string> {
  if (!hasAny(exts)) return core;
  const merged = new Set(core);
  eachComponent(exts, (key, comp) => {
    if (comp.load) merged.add(key);
  });
  return merged;
}

export function collectComponentSchemas(
  exts: BuilderExtension[],
): Array<{ type: string; allowedZones: string[]; requiredProps: string[] }> {
  const out: Array<{ type: string; allowedZones: string[]; requiredProps: string[] }> = [];
  eachComponent(exts, (key, comp) => {
    const schema = comp.schema ?? DEFAULT_SCHEMA;
    out.push({ type: key, allowedZones: schema.allowedZones, requiredProps: schema.requiredProps });
  });
  return out;
}

function hasTemplates(exts: BuilderExtension[]): boolean {
  return exts.some((e) => e?.templates && e.templates.length > 0);
}

export function resolvePluginTemplateData(t: PluginTemplate): Data {
  if (t.data) return t.data;
  if (t.generator) return t.generator();
  throw new Error(`Plugin template "${t.value}" has neither data nor generator`);
}

function toDescriptor(t: PluginTemplate): TemplateDescriptor {
  return {
    value: t.value,
    label: t.label,
    subtitle: t.subtitle ?? '',
    section: t.section,
    thumbnail: t.thumbnail ?? null,
    defaultPageType: t.defaultPageType,
    defaultSlug: t.defaultSlug,
    generator: () => resolvePluginTemplateData(t),
  };
}

export function mergeTemplates(
  coreRegistry: TemplateDescriptor[],
  exts: BuilderExtension[],
): TemplateDescriptor[] {
  if (!hasTemplates(exts)) return coreRegistry;
  const merged = [...coreRegistry];
  const seen = new Set(coreRegistry.map((t) => t.value));
  for (const ext of exts) {
    if (!ext?.templates) continue;
    for (const t of ext.templates) {
      const hasData = t.data != null;
      const hasGenerator = typeof t.generator === 'function';
      if (hasData === hasGenerator) {
        logger.warn('Plugin template skipped: exactly one of { data, generator } is required', {
          value: t.value,
          hasData,
          hasGenerator,
        });
        continue;
      }
      if (seen.has(t.value)) {
        logger.warn('Plugin template value collides with an existing template; core wins', {
          value: t.value,
        });
        continue;
      }
      seen.add(t.value);
      merged.push(toDescriptor(t));
    }
  }
  return merged;
}

export function validateTemplateRequires(
  templates: PluginTemplate[],
  registeredComponentTypes: Set<string>,
): string[] {
  const problems: string[] = [];
  for (const t of templates) {
    for (const type of t.requires ?? []) {
      if (!registeredComponentTypes.has(type)) {
        problems.push(
          `Template "${t.value}" requires "${type}" (no active plugin/core component provides it)`,
        );
      }
    }
  }
  return problems;
}

export function validateNamespaces(
  exts: BuilderExtension[],
  coreComponentKeys: Set<string>,
  coreTemplateValues: Set<string>,
): string[] {
  const problems: string[] = [];
  for (const ext of exts) {
    for (const key of Object.keys(ext?.puckComponents ?? {})) {
      if (!key.includes(':')) {
        problems.push(`Plugin component key "${key}" must be namespaced (e.g. "acme:${key}")`);
      } else if (coreComponentKeys.has(key)) {
        problems.push(`Plugin component key "${key}" collides with a built-in component "${key}"`);
      }
    }
    for (const t of ext?.templates ?? []) {
      if (!t.value.includes(':')) {
        problems.push(`Plugin template value "${t.value}" must be namespaced (e.g. "acme:${t.value}")`);
      } else if (coreTemplateValues.has(t.value)) {
        problems.push(`Plugin template value "${t.value}" collides with a built-in template "${t.value}"`);
      }
    }
  }
  return problems;
}

export function assertBuilderExtensionsValid(
  exts: BuilderExtension[],
  coreComponentKeys: Set<string>,
  coreTemplateValues: Set<string>,
): void {
  if (exts.length === 0) return;
  const registeredComponentTypes = new Set<string>([
    ...coreComponentKeys,
    ...exts.flatMap((e) => Object.keys(e?.puckComponents ?? {})),
  ]);
  const problems = [
    ...validateNamespaces(exts, coreComponentKeys, coreTemplateValues),
    ...validateTemplateRequires(
      exts.flatMap((e) => e?.templates ?? []),
      registeredComponentTypes,
    ),
  ];
  if (problems.length > 0) throw new InvalidBuilderExtensionError(problems);
}
