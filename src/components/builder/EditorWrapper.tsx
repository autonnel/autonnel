import React from 'react';
import {
  Puck,
  blocksPlugin,
  outlinePlugin,
  type Data,
  type Plugin,
  usePuck,
} from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { Bot, Settings } from 'lucide-react';
import { puckConfig } from './config';
import { ComponentListSearch } from './ComponentListSearch';
import { PuckAiPanel } from './PuckAiPanel';
import { mergePropsWithMediaPreservation } from './mergeMediaProps';
import { autonnelFieldTransforms } from './inline-text-transform';

const { useState, useEffect, useCallback, useRef, useMemo } = React;

type SaveState = 'saving' | 'saved' | 'error';

interface EditorWrapperProps {
  initialData: Data;
  planId: string;
  onSave: (data: Data) => void;
  saveStatus: SaveState;
  settingsPanel?: React.ReactNode;
}

const SPIN_KEYFRAME = '@keyframes spin { to { transform: rotate(360deg); } }';
const STRIP_CLASSES = ['h-screen', 'overflow-hidden'] as const;
const GENERATE_ENDPOINT = '/api/component/generate';
const CUSTOM_SUFFIX = /_custom_$/;
const ROOT_INDEX_RE = /root_content_(\d+)/;

type ContentEntry = Data['content'][number];

function patchEntryAt(
  list: ContentEntry[],
  at: number,
  incoming: unknown,
): ContentEntry[] {
  return list.map((entry, position) =>
    position === at
      ? { ...entry, props: mergePropsWithMediaPreservation(entry.props, incoming) }
      : entry,
  );
}

function GenerateAllButton({ planId }: { planId: string }) {
  const { appState, dispatch } = usePuck();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [count, setCount] = useState(0);

  const contentRef = useRef(appState.data.content);
  useEffect(() => {
    contentRef.current = appState.data.content;
  }, [appState.data.content]);

  async function runAll() {
    if (busy) return;
    const entries = appState.data.content;
    if (!entries?.length) return;

    setBusy(true);
    setDone(0);
    setCount(entries.length);

    for (let cursor = 0; cursor < entries.length; cursor++) {
      const entry = entries[cursor];
      setDone(cursor + 1);

      try {
        const section =
          entry.props?._generate?.sectionType || entry.props?._sectionType || '';

        const res = await fetch(GENERATE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId,
            componentType: entry.type,
            componentId: entry.props?.id || `${entry.type}-${cursor}`,
            sectionType: section,
          }),
        });

        if (!res.ok) continue;
        const payload = await res.json();
        const next = patchEntryAt(contentRef.current, cursor, (payload as any).content);

        dispatch({
          type: 'setData',
          data: { ...appState.data, content: next },
        });
        contentRef.current = next;
      } catch (err) {
        console.error(`Error generating ${entry.type}:`, err);
      }
    }

    setBusy(false);
    setDone(0);
    setCount(0);
  }

  const idleGradient = 'linear-gradient(135deg, #4f46e5, #7c3aed)';

  return (
    <button
      onClick={runAll}
      disabled={busy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: busy ? '#9ca3af' : idleGradient,
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: busy ? 'wait' : 'pointer',
        fontSize: '14px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {busy ? (
        <>
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Generating {done}/{count}...
        </>
      ) : (
        <>Generate All Sections</>
      )}
      <style>{SPIN_KEYFRAME}</style>
    </button>
  );
}

function resolveTargetIndex(
  entries: ContentEntry[],
  selectorIndex: number | undefined,
  componentId?: string,
): number | undefined {
  if (componentId) {
    const propsId = componentId.replace(CUSTOM_SUFFIX, '');
    const byProps = entries.findIndex((e) => e.props?.id === propsId);
    if (byProps !== -1) return byProps;

    const m = componentId.match(ROOT_INDEX_RE);
    if (m) return parseInt(m[1], 10);
  }
  if (selectorIndex !== undefined) return selectorIndex;
  return undefined;
}

function GenerateCallbackHandler() {
  const { appState, dispatch } = usePuck();

  const dataRef = useRef(appState.data);
  const dispatchRef = useRef(dispatch);
  const selectorRef = useRef(appState.ui.itemSelector);

  useEffect(() => {
    dataRef.current = appState.data;
  }, [appState.data]);
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);
  useEffect(() => {
    selectorRef.current = appState.ui.itemSelector;
  }, [appState.ui.itemSelector]);

  useEffect(() => {
    (window as any).__puckOnGenerate = (
      _componentType: string,
      content: any,
      componentId?: string,
    ) => {
      const data = dataRef.current;
      const send = dispatchRef.current;
      const selector = selectorRef.current;

      const index = resolveTargetIndex(
        data.content,
        selector && selector.index !== undefined ? selector.index : undefined,
        componentId,
      );

      console.log('[GenerateCallbackHandler] Updating component:', {
        componentId,
        propsId: componentId?.replace(CUSTOM_SUFFIX, ''),
        targetIndex: index,
        contentLength: data.content.length,
      });

      const valid =
        index !== undefined && index >= 0 && index < data.content.length;
      if (!valid) {
        console.warn('[GenerateCallbackHandler] Invalid target index:', index);
        return;
      }

      send({
        type: 'setData',
        data: { ...data, content: patchEntryAt(data.content, index as number, content) },
      });
    };

    return () => {
      delete (window as any).__puckOnGenerate;
    };
  }, []);

  return null;
}

const STATUS_VIEW: Record<
  SaveState,
  { text: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  saving: {
    text: 'Saving...',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    icon: (
      <span
        style={{
          width: '12px',
          height: '12px',
          border: '2px solid #d1d5db',
          borderTopColor: '#6b7280',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
    ),
  },
  saved: {
    text: 'Saved',
    color: '#059669',
    bgColor: '#d1fae5',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
  },
  error: {
    text: 'Save failed',
    color: '#dc2626',
    bgColor: '#fee2e2',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

function SaveStatusIndicator({ status }: { status: SaveState }) {
  const view = STATUS_VIEW[status];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: view.bgColor,
        color: view.color,
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      {view.icon}
      {view.text}
      <style>{SPIN_KEYFRAME}</style>
    </div>
  );
}

function useStripIframeBodyClasses(
  containerRef: React.RefObject<HTMLDivElement | null>,
  onReady: () => void,
) {
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let classWatcher: MutationObserver | null = null;
    let treeWatcher: MutationObserver | null = null;
    let announced = false;

    const announce = () => {
      if (announced) return;
      announced = true;
      onReady();
    };

    const scrub = (body: HTMLElement) => {
      STRIP_CLASSES.forEach((c) => {
        if (body.classList.contains(c)) body.classList.remove(c);
      });
    };

    const attach = (frame: HTMLIFrameElement) => {
      const wire = () => {
        const body = frame.contentDocument?.body;
        if (!body) {
          requestAnimationFrame(wire);
          return;
        }
        scrub(body);
        classWatcher?.disconnect();
        classWatcher = new MutationObserver(() => scrub(body));
        classWatcher.observe(body, { attributes: true, attributeFilter: ['class'] });
        announce();
      };
      wire();
      frame.addEventListener('load', wire);
    };

    const locate = () => {
      const frame = host.querySelector(
        'iframe#preview-frame',
      ) as HTMLIFrameElement | null;
      if (frame) attach(frame);
    };

    locate();
    treeWatcher = new MutationObserver(locate);
    treeWatcher.observe(host, { childList: true, subtree: true });

    return () => {
      classWatcher?.disconnect();
      treeWatcher?.disconnect();
    };
  }, [containerRef, onReady]);
}

function PuckLoading() {
  return (
    <div
      aria-live="polite"
      aria-label="Loading editor"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'var(--ds-app, #f8fafc)',
        color: 'var(--ds-mutedText, #64748b)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="28 85"
          transform="rotate(-90 22 22)"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 22 22"
            to="360 22 22"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      <div>Loading editor…</div>
    </div>
  );
}

function useRailPlugins(planId: string, settingsPanel?: React.ReactNode): Plugin[] {
  const ai = useMemo<Plugin>(
    () => ({
      name: 'ai',
      label: 'AI',
      icon: <Bot size={22} />,
      render: () => <PuckAiPanel pageId={planId} />,
      mobilePanelHeight: 'toggle',
    }),
    [planId],
  );

  const settings = useMemo<Plugin>(
    () => ({
      name: 'settings',
      label: 'Settings',
      icon: <Settings size={22} />,
      render: () => (
        <div className="autonnel-puck-settings-panel">{settingsPanel}</div>
      ),
      mobilePanelHeight: 'toggle',
    }),
    [settingsPanel],
  );

  return useMemo(
    () => [ai, blocksPlugin(), settings, outlinePlugin()],
    [ai, settings],
  );
}

export function EditorWrapper({ initialData, planId, onSave, settingsPanel }: EditorWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const markReady = useCallback(() => setReady(true), []);
  useStripIframeBodyClasses(containerRef, markReady);

  const puckOverride = useCallback(
    ({ children }: { children?: React.ReactNode }) => (
      <>
        <GenerateCallbackHandler />
        {children}
      </>
    ),
    [],
  );

  const plugins = useRailPlugins(planId, settingsPanel);

  return (
    <div className="puck-editor-container" ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      {!ready && <PuckLoading />}
      <Puck
        config={puckConfig}
        data={initialData}
        height="100%"
        plugins={plugins}
        ui={{
          leftSideBarVisible: true,
          rightSideBarVisible: true,
          plugin: { current: 'ai' },
        }}
        iframe={{ waitForStyles: false }}
        onChange={onSave}
        fieldTransforms={autonnelFieldTransforms as any}
        overrides={{
          header: () => <></>,
          puck: puckOverride,
          drawer: ComponentListSearch,
        }}
      />
    </div>
  );
}

export default EditorWrapper;
