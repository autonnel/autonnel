import React, { useCallback } from 'react';
import type { Editor } from 'grapesjs';
import type { MutableRefObject } from 'react';
import { AiPanelBase } from '@/components/ai-panel/AiPanelBase';
import { useGrapesAdapter } from './ai-panel/grapes-adapter';
import { useImagePrompts } from './ImagePromptsContext';
import { useImageGeneration } from './useImageGeneration';

export interface GrapesJSAgentPanelProps {
  pageId: string;
  editorRef: MutableRefObject<Editor | null>;
}

export function GrapesJSAgentPanel({ pageId, editorRef }: GrapesJSAgentPanelProps) {
  const { mergeImagePrompts } = useImagePrompts();
  const { generate } = useImageGeneration();

  const generateForPid = useCallback(
    async (pid: string, prompt: string) => {
      const url = await generate(pid, { prompt, aspectRatio: '1:1' });
      const editor = editorRef.current;
      if (editor) {
        const comp = editor.getWrapper()?.find(`[data-pid="${pid}"]`)?.[0];
        if (comp) {
          comp.setAttributes({ ...comp.getAttributes(), src: url });
        }
      }
      return url;
    },
    [editorRef, generate],
  );

  const adapter = useGrapesAdapter(editorRef, {
    mergeImagePrompts,
    generateForPid,
  });

  return <AiPanelBase pageId={pageId} adapter={adapter} />;
}
