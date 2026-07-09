
import { tool } from 'ai';
import { z } from 'zod';

export interface PageState {
  root: Record<string, any>;
  content: Array<{ type: string; props: Record<string, any> }>;
}

export interface ComponentInfo {
  name: string;
  label: string;
  category: string;
  defaultProps?: Record<string, any>;
  arrayItemKeys?: Record<string, string[]>;
}

export function createPageTools(initialState: PageState, componentCatalog: ComponentInfo[]) {
  const state: PageState = {
    root: { ...initialState.root },
    content: initialState.content.map((c) => ({ type: c.type, props: { ...c.props } })),
  };

  const schemaByType = new Map(
    componentCatalog.map((c) => [c.name, c.defaultProps]),
  );
  const arrayKeysByType = new Map(
    componentCatalog.map((c) => [c.name, c.arrayItemKeys]),
  );
  const validPropNames = (type: string): string[] => {
    const dp = schemaByType.get(type);
    return dp ? Object.keys(dp) : [];
  };

  // The renderer silently drops unknown keys, so surface them in the tool result —
  // both top-level props and keys inside array items (e.g. reviews[].author, not .name).
  const propWarnings = (type: string, props: Record<string, any>): string[] => {
    const warnings: string[] = [];
    const valid = validPropNames(type);
    if (valid.length > 0) {
      const unknown = Object.keys(props).filter((k) => k !== 'id' && !valid.includes(k));
      if (unknown.length > 0) {
        warnings.push(
          `These prop names are not read by the ${type} renderer and will NOT appear on the page: ${unknown.join(', ')}. Valid props are: ${valid.join(', ')}.`,
        );
      }
    }
    const arrayKeys = arrayKeysByType.get(type);
    if (arrayKeys) {
      for (const [fieldName, itemKeys] of Object.entries(arrayKeys)) {
        const list = props[fieldName];
        if (!Array.isArray(list) || itemKeys.length === 0) continue;
        const unknownItemKeys = new Set<string>();
        for (const item of list) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
          for (const k of Object.keys(item)) {
            if (!itemKeys.includes(k)) unknownItemKeys.add(k);
          }
        }
        if (unknownItemKeys.size > 0) {
          warnings.push(
            `Inside ${type}.${fieldName}[] these item keys are IGNORED by the renderer: ${[...unknownItemKeys].join(', ')}. Each ${fieldName} item must use ONLY these keys: ${itemKeys.join(', ')}. Rewrite the ${fieldName} array with the correct item keys or the section will render empty.`,
          );
        }
      }
    }
    return warnings;
  };

  const getAvailableComponents = tool({
    description:
      'Returns the list of all available Puck components that can be added to the page. Call this first before adding any components to understand what is available.',
    inputSchema: z.object({}),
    execute: async () => componentCatalog,
  });

  const getPageState = tool({
    description:
      'Returns the current page state including all components (with their types, props, and indices), root properties, and the total count. Each component also includes `validPropNames` (the only prop keys the renderer reads) and `schema` (the default props shape). Props not in `validPropNames` are IGNORED by the renderer — when updating, use only these keys.',
    inputSchema: z.object({}),
    execute: async () => ({
      root: state.root,
      content: state.content.map((item, index) => ({
        index,
        type: item.type,
        props: item.props,
        validPropNames: validPropNames(item.type),
        schema: schemaByType.get(item.type),
      })),
      count: state.content.length,
    }),
  });

  const addComponent = tool({
    description:
      'Add a new component to the page at the specified index. Use getAvailableComponents first to know valid component type names.',
    inputSchema: z.object({
      type: z.string().describe('The component type name, e.g. "HeroPanel", "Footer", "FaqAccordion"'),
      index: z.number().describe('Position to insert at (0 = beginning, N = end of list)'),
      props: z.record(z.string(), z.any()).optional().describe('Initial props for the component'),
    }),
    execute: async ({ type, index, props }: { type: string; index: number; props?: Record<string, any> }) => {
      const newItem = { type, props: props || {} };
      if (index >= state.content.length) {
        state.content.push(newItem);
      } else {
        state.content.splice(index, 0, newItem);
      }
      const warnings = propWarnings(type, newItem.props);
      return {
        addedAt: { index: Math.min(index, state.content.length - 1), type },
        newCount: state.content.length,
        ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
        added: 1,
        removed: 0,
        unit: 'components',
      };
    },
  });

  const removeComponent = tool({
    description: 'Remove a component from the page by its index. Use getPageState to find the correct index.',
    inputSchema: z.object({
      index: z.number().describe('The index of the component to remove'),
    }),
    execute: async ({ index }: { index: number }) => {
      if (index < 0 || index >= state.content.length) {
        return { error: `Index ${index} out of bounds (0-${state.content.length - 1})` };
      }
      const removed = state.content[index];
      state.content.splice(index, 1);
      return {
        removedItem: { type: removed.type },
        newCount: state.content.length,
        added: 0,
        removed: 1,
        unit: 'components',
      };
    },
  });

  const updateComponent = tool({
    description:
      'Update the props of an existing component at a given index. Pass only the fields you want to change — they will be merged with existing props. Use getPageState first to see current props and indices.',
    inputSchema: z.object({
      index: z.number().describe('The index of the component to update'),
      props: z.record(z.string(), z.any()).describe('Props to merge into the component. Only include fields to change.'),
    }),
    execute: async ({ index, props }: { index: number; props: Record<string, any> }) => {
      if (index < 0 || index >= state.content.length) {
        return { error: `Index ${index} out of bounds (0-${state.content.length - 1})` };
      }
      const type = state.content[index].type;
      state.content[index].props = { ...state.content[index].props, ...props };
      const changedKeys = Object.keys(props);
      const warnings = propWarnings(type, props);
      return {
        updated: { index, type, changedFields: changedKeys },
        ...(warnings.length > 0
          ? { warning: `${warnings.join(' ')} Re-update using only valid keys.` }
          : {}),
        added: changedKeys.length,
        removed: 0,
        unit: 'props',
      };
    },
  });

  const reorderComponents = tool({
    description:
      'Move a component from one index to another. The target index is the desired position after removal of the source item.',
    inputSchema: z.object({
      fromIndex: z.number().describe('Current index of the component to move'),
      toIndex: z.number().describe('Target index after the move'),
    }),
    execute: async ({ fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
      if (fromIndex < 0 || fromIndex >= state.content.length) {
        return { error: `fromIndex ${fromIndex} out of bounds (0-${state.content.length - 1})` };
      }
      if (toIndex < 0 || toIndex > state.content.length) {
        return { error: `toIndex ${toIndex} out of bounds (0-${state.content.length})` };
      }
      const [item] = state.content.splice(fromIndex, 1);
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      state.content.splice(adjustedIndex, 0, item);
      return {
        moved: { type: item.type, from: fromIndex, to: adjustedIndex },
        added: 0,
        removed: 0,
        unit: 'move',
      };
    },
  });

  const setRootProps = tool({
    description: 'Update page-level root properties such as maxWidth, fontFamily, fontSize, or language.',
    inputSchema: z.object({
      props: z.record(z.string(), z.any()).describe('Root props to merge, e.g. { maxWidth: "1080px", fontFamily: "Inter" }'),
    }),
    execute: async ({ props }: { props: Record<string, any> }) => {
      state.root = { ...state.root, ...props };
      const changedKeys = Object.keys(props).length;
      return {
        root: state.root,
        added: changedKeys,
        removed: 0,
        unit: 'root props',
      };
    },
  });

  return {
    getPageState: () => state,
    tools: {
      getAvailableComponents,
      getPageState,
      addComponent,
      removeComponent,
      updateComponent,
      reorderComponents,
      setRootProps,
    },
  };
}
