
type PuckItem = { type: string; props: Record<string, any> };
type PuckRoot = { props?: Record<string, any> };
type PuckData = { content: PuckItem[]; root?: PuckRoot };

export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  'addComponent',
  'removeComponent',
  'updateComponent',
  'reorderComponents',
  'setRootProps',
]);

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function applyToolToData(data: PuckData, toolName: string, input: any): PuckData {
  const content = Array.isArray(data.content) ? [...data.content] : [];
  const root: PuckRoot = data.root ?? { props: {} };

  switch (toolName) {
    case 'addComponent': {
      const type = typeof input?.type === 'string' ? input.type : '';
      if (!type) return data;
      const idx = typeof input?.index === 'number' ? input.index : content.length;
      const newProps = (input?.props && typeof input.props === 'object' ? input.props : {}) as Record<string, any>;
      const newItem: PuckItem = {
        type,
        props: { id: generateId(), ...newProps },
      };
      const clamped = Math.max(0, Math.min(idx, content.length));
      content.splice(clamped, 0, newItem);
      return { ...data, content };
    }
    case 'removeComponent': {
      const idx = input?.index;
      if (typeof idx === 'number' && idx >= 0 && idx < content.length) {
        content.splice(idx, 1);
      }
      return { ...data, content };
    }
    case 'updateComponent': {
      const idx = input?.index;
      const patch = (input?.props && typeof input.props === 'object' ? input.props : {}) as Record<string, any>;
      if (typeof idx === 'number' && content[idx]) {
        content[idx] = {
          ...content[idx],
          props: { ...content[idx].props, ...patch },
        };
      }
      return { ...data, content };
    }
    case 'reorderComponents': {
      const from = input?.fromIndex;
      const to = input?.toIndex;
      if (
        typeof from === 'number' &&
        typeof to === 'number' &&
        from >= 0 &&
        from < content.length &&
        to >= 0 &&
        to < content.length
      ) {
        const [item] = content.splice(from, 1);
        if (item) content.splice(to, 0, item);
      }
      return { ...data, content };
    }
    case 'setRootProps': {
      const patch = (input?.props && typeof input.props === 'object' ? input.props : {}) as Record<string, any>;
      return {
        ...data,
        root: { ...root, props: { ...(root.props ?? {}), ...patch } },
      };
    }
    default:
      return data;
  }
}

export function formatToolLabel(toolName: string, input: any): string {
  switch (toolName) {
    case 'addComponent':
      return `addComponent(${input?.type ?? '?'} @${input?.index ?? '?'})`;
    case 'removeComponent':
      return `removeComponent(@${input?.index ?? '?'})`;
    case 'updateComponent':
      return `updateComponent(@${input?.index ?? '?'})`;
    case 'reorderComponents':
      return `reorderComponents(${input?.fromIndex ?? '?'} → ${input?.toIndex ?? '?'})`;
    case 'setRootProps':
      return 'setRootProps';
    default:
      return toolName;
  }
}
