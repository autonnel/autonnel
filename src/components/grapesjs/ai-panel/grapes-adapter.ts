import { useMemo, type MutableRefObject } from 'react';
import type { Editor } from 'grapesjs';
import type {
  AiPanelAdapter,
  AdapterCapabilities,
  DonePayload,
  SelectionLabel,
  ToolCallEvent,
} from '@/components/ai-panel/types';
import { assignAids, stripAidsFromEditor } from '@/components/ai-panel/aid';

const MUTATING = new Set(['rewriteText', 'replaceSection', 'appendCss', 'setImagePrompt']);

function formatLabel(toolName: string, input: unknown): string {
  const aid = (input as { aid?: string })?.aid;
  switch (toolName) {
    case 'getCurrentPage':
      return 'Reading page';
    case 'rewriteText':
      return `Rewriting #${aid ?? '?'}`;
    case 'replaceSection':
      return `Swapping #${aid ?? '?'}`;
    case 'appendCss':
      return 'Adding styles';
    case 'setImagePrompt':
      return `Image prompt #${aid ?? '?'}`;
    default:
      return toolName;
  }
}

export interface GrapesAdapterDeps {
  mergeImagePrompts: (updates: Record<string, string>) => void;
  generateForPid: (pid: string, prompt: string) => Promise<string>;
}

export function useGrapesAdapter(
  editorRef: MutableRefObject<Editor | null>,
  deps: GrapesAdapterDeps,
): AiPanelAdapter {
  return useMemo<AiPanelAdapter>(() => {
    return {
      endpoint: '/api/page/grapes-ai-chat',
      welcomeMessage:
        "Hi! Describe a change to this HTML page and I'll edit it. E.g. 'rewrite the copy for a buckwheat pillow' or 'change the headline to …'.",
      placeholder: 'Describe a change to this page, or paste a reference image…',

      beforeSend() {
        const editor = editorRef.current;
        if (!editor) return;
        assignAids(editor);
      },

      getState() {
        const editor = editorRef.current;
        if (!editor) return { html: '', css: '', selectedAid: undefined };
        const selected = editor.getSelected();
        const selectedAid = selected?.getAttributes()['data-aid'] as string | undefined;
        return {
          html: editor.getHtml(),
          css: editor.getCss() || '',
          selectedAid,
        };
      },

      getStateField() {
        return 'currentPage';
      },

      getSelectionHint() {
        const editor = editorRef.current;
        if (!editor) return null;
        const sel = editor.getSelected();
        if (!sel) return null;
        const attrs = sel.getAttributes();
        const aid = attrs['data-aid'];
        if (!aid) return null;
        const tag = sel.get('tagName') || 'div';
        const cls = attrs['class'] ?? '';
        return {
          description: `[Selected element: aid="${aid}", tag="${tag}"${cls ? `, class="${cls}"` : ''}]`,
        };
      },

      getSelectionLabel(): SelectionLabel | null {
        const editor = editorRef.current;
        if (!editor) return null;
        const sel = editor.getSelected();
        if (!sel) return null;
        const attrs = sel.getAttributes();
        const aid = attrs['data-aid'];
        const tag = sel.get('tagName') || 'div';
        return {
          label: tag,
          sublabel: aid ? `#${aid}` : undefined,
        };
      },

      clearSelection() {
        const editor = editorRef.current;
        if (!editor) return;
        const sel = editor.getSelected();
        if (sel) editor.selectRemove(sel);
      },

      getCapabilities(): AdapterCapabilities {
        return { supportsImageGeneration: true };
      },

      applyTool({ toolName, input }: ToolCallEvent) {
        const editor = editorRef.current;
        if (!editor) return;
        const arg = input as { aid?: string; text?: string; html?: string; css?: string };
        try {
          if (toolName === 'rewriteText' && arg.aid && typeof arg.text === 'string') {
            const found = editor.getWrapper()?.find(`[data-aid="${arg.aid}"]`)?.[0];
            if (found) found.components(arg.text);
          } else if (toolName === 'replaceSection' && arg.aid && typeof arg.html === 'string') {
            const found = editor.getWrapper()?.find(`[data-aid="${arg.aid}"]`)?.[0];
            if (found) found.replaceWith(arg.html);
          } else if (toolName === 'appendCss' && typeof arg.css === 'string') {
            editor.setStyle((editor.getCss() || '') + '\n' + arg.css);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[GrapesAdapter] applyTool failed', toolName, err);
        }
      },

      applyDone(payload: DonePayload) {
        const editor = editorRef.current;
        if (!editor) return;
        if (typeof payload.html === 'string') {
          editor.setComponents(payload.html);
        }
        if (typeof payload.css === 'string') {
          editor.setStyle(payload.css);
        }
        if (payload.imagePromptUpdates && Object.keys(payload.imagePromptUpdates).length > 0) {
          deps.mergeImagePrompts(payload.imagePromptUpdates);
          if (payload.autoGenerateImages) {
            for (const [pid, prompt] of Object.entries(payload.imagePromptUpdates)) {
              deps.generateForPid(pid, prompt).catch((err) => {
                // eslint-disable-next-line no-console
                console.warn('[GrapesAdapter] auto-gen failed for', pid, err);
              });
            }
          }
        }
        stripAidsFromEditor(editor);
      },

      formatToolLabel: formatLabel,
      isMutatingTool: (name: string) => MUTATING.has(name),
    };
  }, [editorRef, deps]);
}
