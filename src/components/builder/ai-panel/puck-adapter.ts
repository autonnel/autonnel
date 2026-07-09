import { useMemo, useRef } from 'react';
import { usePuck } from '@puckeditor/core';
import type {
  AiPanelAdapter,
  DonePayload,
  SelectionLabel,
  ToolCallEvent,
} from '@/components/ai-panel/types';
import type { PendingMediaItem } from '@/components/ai-panel/media-autogen';
import { applyToolToData, formatToolLabel, MUTATING_TOOLS } from './applyToolToData';
import { collectPendingMedia, applyMediaUrlToData } from './pending-media';

const DEFAULT_PAGE_MAX_WIDTH = '1080';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function ensureIds(content: Array<{ type: string; props?: Record<string, unknown> }>) {
  return content.map((c) => ({
    type: c.type,
    props:
      c.props && typeof c.props === 'object' && 'id' in c.props
        ? c.props
        : { id: generateId(), ...(c.props ?? {}) },
  }));
}

export function usePuckAdapter(): AiPanelAdapter {
  const { appState, dispatch } = usePuck();

  // Media generation continues after the agent turn returns, so patches must be
  // computed against the latest data, not the render that started the turn.
  const dataRef = useRef(appState.data);
  dataRef.current = appState.data;

  return useMemo<AiPanelAdapter>(() => {
    let working = appState.data;

    return {
      endpoint: '/api/page/ai-chat',
      welcomeMessage:
        "Hi! Tell me what page you want to build and I'll create it for you. You can paste screenshots or reference images to help me match a design.",
      placeholder: 'Describe what you want to build, or paste an image…',

      beforeSend() {
        working = appState.data;
      },

      getState() {
        return {
          root: appState.data.root ?? { props: {} },
          content: appState.data.content ?? [],
        };
      },

      getStateField() {
        return 'currentData';
      },

      getSelectionHint() {
        const sel = (appState.ui as { itemSelector?: { index?: number } | null })?.itemSelector;
        if (!sel || typeof sel.index !== 'number') return null;
        const item = appState.data.content?.[sel.index];
        if (!item || typeof item.type !== 'string') return null;
        const props = (item.props ?? {}) as Record<string, unknown>;
        const propsStr = JSON.stringify(props).substring(0, 500);
        return {
          description: `[Selected component: index ${sel.index}, type "${item.type}", props: ${propsStr}]`,
        };
      },

      getSelectionLabel(): SelectionLabel | null {
        const sel = (appState.ui as { itemSelector?: { index?: number } | null })?.itemSelector;
        if (!sel || typeof sel.index !== 'number') return null;
        const item = appState.data.content?.[sel.index];
        if (!item || typeof item.type !== 'string') return null;
        return { label: item.type, sublabel: `#${sel.index}` };
      },

      clearSelection() {
        dispatch({ type: 'setUi', ui: { itemSelector: null } });
      },

      getCapabilities() {
        return { supportsImageGeneration: true };
      },

      applyTool({ toolName, input }: ToolCallEvent) {
        working = applyToolToData(working as any, toolName, input) as typeof working;
        dataRef.current = working;
        dispatch({ type: 'setData', data: working });
      },

      applyDone(payload: DonePayload) {
        if (!payload.content) return;
        const newContent = ensureIds(payload.content);
        const currentRoot = appState.data.root ?? { props: {} };
        const incomingRootProps = (payload.root as any)?.props ?? payload.root ?? {};
        const mergedProps = { ...(currentRoot.props ?? {}), ...incomingRootProps };
        // A page-building agent that forgets maxWidth leaves every section
        // stretched edge-to-edge; default to a sane content width instead.
        if (!mergedProps.maxWidth) mergedProps.maxWidth = DEFAULT_PAGE_MAX_WIDTH;
        const next = {
          ...appState.data,
          content: newContent,
          root: { ...currentRoot, props: mergedProps },
        };
        dataRef.current = next;
        dispatch({ type: 'setData', data: next });
      },

      getPendingMedia(): PendingMediaItem[] {
        return collectPendingMedia((dataRef.current.content ?? []) as any);
      },

      applyGeneratedMedia(item: PendingMediaItem, url: string) {
        const next = applyMediaUrlToData(dataRef.current as any, item, url);
        dataRef.current = next;
        dispatch({ type: 'setData', data: next });
      },

      formatToolLabel,
      isMutatingTool: (name: string) => MUTATING_TOOLS.has(name),
    };
  }, [appState, dispatch]);
}
