import type { Config, Data } from '@puckeditor/core';

type Item = { type: string; props?: Record<string, any> };

// Puck's editor seeds component data with defaultProps and re-merges them at render time,
// but @puckeditor/core/rsc <Render> (the published + preview path) does neither. Back-filling
// the same defaults at the data layer keeps the editor, preview, and live page identical and
// ensures interactive islands serialize their full props instead of just {id, puck}.

function isComponentList(value: unknown, config: Config): value is Item[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as Item).type === 'string' &&
        (config.components as Record<string, unknown>)[(entry as Item).type] !== undefined,
    )
  );
}

function mergeItemDefaults(item: Item, config: Config): Item {
  const componentConfig = (config.components as Record<string, any>)[item.type];
  if (!componentConfig) return item;

  const defaults = (componentConfig.defaultProps as Record<string, any>) || {};
  const props: Record<string, any> = { ...defaults, ...(item.props || {}) };

  for (const [key, value] of Object.entries(props)) {
    if (isComponentList(value, config)) {
      props[key] = value.map((child) => mergeItemDefaults(child, config));
    }
  }

  return { ...item, props };
}

export function applyPuckDefaults(data: Data, config: Config): Data {
  if (!data) return data;

  const rootDefaults = ((config.root as any)?.defaultProps as Record<string, any>) || {};
  const root = (data as any).root || {};
  const content = ((data as any).content as Item[] | undefined) || [];

  return {
    ...data,
    root: { ...root, props: { ...rootDefaults, ...(root.props || {}) } },
    content: content.map((item) => mergeItemDefaults(item, config)),
  } as Data;
}
