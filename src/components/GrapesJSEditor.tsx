import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import grapesjs from 'grapesjs';
import type { Editor } from 'grapesjs';
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import gjsBlocksBasic from 'grapesjs-blocks-basic';
import 'grapesjs/dist/css/grapes.min.css';
import '@/styles/grapesjs-ds-theme.css';
import { registerAllTraits } from '@/components/grapesjs/traits';
import { getInitialScriptsOn, persistScriptsOn } from '@/components/grapesjs/canvasScripts';
import { tagMediaWithPids } from '@/lib/ai/pid-utils';
import { apiCall } from '@/lib/api/client';
import { GrapesJSAgentPanel } from '@/components/grapesjs/GrapesJSAgentPanel';
import { ImageAiOverlay } from '@/components/grapesjs/ImageAiOverlay';
import { ImportModal, SourceEditorModal, DEFAULT_HTML } from '@/components/GrapesJSModals';
import {
  INTER_FONT_URL,
  NATIVE_VIEW_COMMANDS,
  extractStylesheetHrefs,
  extractScripts,
  extractInlineStyles,
  extractHeadStyleBlocks,
} from '@/components/grapesjs/html-extract';
import {
  INLINE_TEXT_TYPE,
  NATIVE_PANE_SELECTORS,
  hideNativePane,
  showNativePane,
} from '@/components/grapesjs/editor-setup';

export interface GrapesJSEditorRef {
  openImportModal(): void;
  getContent(): { html: string; css: string; editorData: any } | null;
}

export interface GrapesJSEditorProps {
  initialContent: string;
  initialCss?: string;
  initialHeadContent?: string;
  initialBodyScripts?: string;
  initialEditorData?: any;
  onSave: (html: string, css: string, editorData: any) => void;
  onSaveCss?: (css: string) => void;
  onSaveHeadContent?: (headContent: string) => void;
  onSaveBodyScripts?: (bodyScripts: string) => void;
  saveStatus: 'saving' | 'saved' | 'error';
  pageId: string;
  onImportClick?: () => void;
}

const GrapesJSEditor = forwardRef<GrapesJSEditorRef, GrapesJSEditorProps>(function GrapesJSEditor(
  {
    initialContent,
    initialCss,
    initialHeadContent,
    initialBodyScripts,
    initialEditorData,
    onSave,
    onSaveCss,
    onSaveHeadContent,
    onSaveBodyScripts,
    saveStatus: _saveStatus,
    pageId,
    onImportClick: _onImportClick,
  },
  ref,
) {
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const headContentRef = useRef<string>(initialHeadContent || '');
  const bodyScriptsRef = useRef<string>(initialBodyScripts || '');

  const [isEditorReady, setIsEditorReady] = useState(false);
  const [agentTarget, setAgentTarget] = useState<HTMLElement | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');
  const [sourceCss, setSourceCss] = useState('');

  useEffect(() => {
    headContentRef.current = initialHeadContent || '';
  }, [initialHeadContent]);

  useEffect(() => {
    bodyScriptsRef.current = initialBodyScripts || '';
  }, [initialBodyScripts]);

  useImperativeHandle(
    ref,
    () => ({
      openImportModal() {
        setIsImportOpen(true);
      },
      getContent() {
        const editor = editorRef.current;
        if (!editor) return null;
        return {
          html: editor.getHtml(),
          css: editor.getCss() || '',
          editorData: editor.getProjectData(),
        };
      },
    }),
    [],
  );

  const applyHtmlToEditor = useCallback(
    (editor: Editor, rawHtml: string) => {
      const { withoutScripts, scripts } = extractScripts(rawHtml);
      if (scripts.length > 0 && !bodyScriptsRef.current) {
        const joined = scripts.join('\n');
        bodyScriptsRef.current = joined;
        onSaveBodyScripts?.(joined);
      }
      const { withoutStyles, css } = extractInlineStyles(withoutScripts);
      const cssToLoad = initialCss || css.trim();
      const cleanContent = withoutStyles;

      editor.setComponents(cleanContent);
      const tagged = tagMediaWithPids(editor.getHtml());
      editor.setComponents(tagged);
      if (cssToLoad) editor.setStyle(cssToLoad);
    },
    [initialCss, onSaveBodyScripts],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const extractedUrls = extractStylesheetHrefs(headContentRef.current);
    const canvasStyles = [INTER_FONT_URL, ...extractedUrls];

    const editor = grapesjs.init({
      container,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      avoidInlineStyle: false,
      forceClass: false,
      plugins: [gjsBlocksBasic, gjsPresetWebpage],
      pluginsOpts: {
        [gjsBlocksBasic as any]: { flexGrid: true },
        [gjsPresetWebpage as any]: {
          modalImportTitle: 'Import Template',
          useCustomTheme: true,
          modalImportButton: 'Import',
        },
      },
      deviceManager: {
        devices: [
          { name: 'Desktop', width: '' },
          { name: 'Tablet', width: '768px', widthMedia: '992px' },
          { name: 'Mobile portrait', width: '320px', widthMedia: '575px' },
        ],
      },
      assetManager: {
        upload: `/api/page/${pageId}/upload-asset`,
        uploadName: 'file',
        multiUpload: false,
        autoAdd: true,
      },
      canvas: {
        styles: canvasStyles,
      },
    } as any);

    editorRef.current = editor;

    editor.DomComponents.addType('inline-text', INLINE_TEXT_TYPE);

    registerAllTraits(editor);

    editor.Commands.add('custom-import-url', {
      run() {
        setIsImportOpen(true);
      },
    });

    editor.Commands.add('custom-edit-source', {
      run(ed: Editor) {
        setSourceHtml(ed.getHtml());
        setSourceCss(ed.getCss() || '');
        setIsSourceOpen(true);
      },
    });

    editor.Commands.add('toggle-run-scripts', {
      async run(ed: Editor) {
        const combined = `${headContentRef.current || ''}\n${bodyScriptsRef.current || ''}`;
        const temp = document.createElement('div');
        temp.innerHTML = combined;
        const scriptEls = Array.from(temp.querySelectorAll('script'));
        if (scriptEls.length === 0) return;

        const doc = ed.Canvas.getDocument();
        if (!doc) return;

        for (const original of scriptEls) {
          const clone = doc.createElement('script');
          clone.setAttribute('data-gjs-injected', 'true');
          if (original.src) {
            for (const attr of Array.from(original.attributes)) {
              if (attr.name === 'defer' || attr.name === 'async') continue;
              clone.setAttribute(attr.name, attr.value);
            }
            await new Promise<void>((resolve) => {
              clone.onload = () => resolve();
              clone.onerror = () => {
                console.warn('[GrapesJSEditor] external script failed to load', original.src);
                resolve();
              };
              doc.body.appendChild(clone);
            });
          } else {
            for (const attr of Array.from(original.attributes)) {
              clone.setAttribute(attr.name, attr.value);
            }
            clone.textContent = original.textContent;
            doc.body.appendChild(clone);
          }
        }

        try {
          doc.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
          const win = doc.defaultView as any;
          if (win) {
            win.dispatchEvent(new Event('DOMContentLoaded'));
            win.dispatchEvent(new Event('load'));
            if (win.jQuery) {
              try {
                win.jQuery(doc).trigger('ready');
              } catch {
                /* noop */
              }
            }
          }
        } catch {
          /* noop */
        }

        persistScriptsOn(pageId, true);
      },
      stop(ed: Editor) {
        const doc = ed.Canvas.getDocument();
        if (doc) {
          doc.querySelectorAll('script[data-gjs-injected]').forEach((el) => el.remove());
        }
        ed.setComponents(ed.getHtml());
        ed.setStyle(ed.getCss() || '');
        persistScriptsOn(pageId, false);
      },
    });

    editor.Commands.add('show-agent', {
      run(ed: Editor) {
        NATIVE_PANE_SELECTORS.forEach(hideNativePane);
        document.querySelectorAll<HTMLElement>('.gjs-agent-view').forEach((el) => {
          el.style.display = 'flex';
        });
        NATIVE_VIEW_COMMANDS.forEach((name) => {
          const btn = ed.Panels.getButton('views', name);
          if (btn) btn.set('active', false);
        });
        const agentBtn = ed.Panels.getButton('views', 'open-agent');
        if (agentBtn) agentBtn.set('active', true);
      },
      stop(ed: Editor) {
        NATIVE_PANE_SELECTORS.forEach(showNativePane);
        document.querySelectorAll<HTMLElement>('.gjs-agent-view').forEach((el) => {
          el.style.display = 'none';
        });
        const agentBtn = ed.Panels.getButton('views', 'open-agent');
        if (agentBtn) agentBtn.set('active', false);
      },
    });

    editor.Panels.removeButton('options', 'preview');
    editor.Panels.removeButton('options', 'export-template');
    editor.Panels.removeButton('options', 'gjs-open-import-webpage');
    editor.Panels.removeButton('options', 'canvas-clear');

    editor.Panels.addButton('options', {
      id: 'edit-source',
      className: 'fa fa-code',
      command: 'custom-edit-source',
      attributes: { title: 'Edit source' },
    });
    editor.Panels.addButton('options', {
      id: 'run-scripts',
      className: 'fa fa-play',
      command: 'toggle-run-scripts',
      attributes: { title: 'Run scripts' },
      active: false,
    });

    editor.Panels.addButton('views', {
      id: 'open-agent',
      className: 'fa fa-comment',
      command: 'show-agent',
      attributes: { title: 'AI Agent' },
    });

    NATIVE_VIEW_COMMANDS.forEach((name) => {
      editor.on(`run:${name}`, () => editor.stopCommand('show-agent'));
    });

    editor.on('load', () => {
      if (initialEditorData) {
        editor.loadProjectData(initialEditorData);
      } else {
        const contentToLoad = initialContent.trim() || DEFAULT_HTML;
        applyHtmlToEditor(editor, contentToLoad);
      }

      const headStyleBlocks = extractHeadStyleBlocks(headContentRef.current);
      if (headStyleBlocks.length > 0) {
        const doc = editor.Canvas.getDocument();
        if (doc && doc.head) {
          for (const block of headStyleBlocks) {
            const styleEl = doc.createElement('style');
            styleEl.textContent = block;
            doc.head.appendChild(styleEl);
          }
        }
      }

      if (getInitialScriptsOn(pageId)) {
        const runBtn = editor.Panels.getButton('options', 'run-scripts');
        if (runBtn) runBtn.set('active', true);
        editor.runCommand('toggle-run-scripts');
      }

      apiCall('GET /api/page/:pageId/assets', null, { params: { pageId } })
        .then((res) => {
          const assets = res?.assets ?? [];
          if (assets.length > 0) {
            editor.AssetManager.add(assets.map((a) => ({ src: a.src })));
          }
        })
        .catch(() => {
          /* swallow */
        });

      const viewsContainer = document.querySelector('.gjs-pn-views-container');
      if (viewsContainer) {
        let host = viewsContainer.querySelector<HTMLElement>('.gjs-agent-view');
        if (!host) {
          host = document.createElement('div');
          host.className = 'gjs-agent-view';
          host.style.display = 'none';
          viewsContainer.appendChild(host);
        }
        setAgentTarget(host);
      }

      if (!editor.getSelected()) {
        editor.runCommand('show-agent');
      }

      editor.setComponents(tagMediaWithPids(editor.getHtml()));
      setIsEditorReady(true);
    });

    editor.on('change:changesCount', () => {
      onSave(editor.getHtml(), editor.getCss() || '', editor.getProjectData());
    });

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const handleImport = useCallback(
    async (url: string) => {
      setIsImporting(true);
      setImportError(null);
      try {
        const res = await fetch(`/api/page/${pageId}/import-html`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = (await res.json().catch(() => ({}))) as { html?: string; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

        const editor = editorRef.current;
        if (editor && data.html) {
          applyHtmlToEditor(editor, data.html);

          const runBtn = editor.Panels.getButton('options', 'run-scripts');
          if (runBtn) runBtn.set('active', true);
          editor.runCommand('toggle-run-scripts');
          persistScriptsOn(pageId, true);
        }
        setIsImportOpen(false);
      } catch (e) {
        setImportError(e instanceof Error ? e.message : 'Failed to import');
      } finally {
        setIsImporting(false);
      }
    },
    [pageId, applyHtmlToEditor],
  );

  const handleApplySource = useCallback(
    (html: string, css: string, headContent: string, bodyScripts: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const { withoutScripts, scripts } = extractScripts(html);
      const { withoutStyles, css: inlineCss } = extractInlineStyles(withoutScripts);

      const mergedScripts = [bodyScripts, ...scripts].filter(Boolean).join('\n');
      const mergedCss = [css, inlineCss].filter(Boolean).join('\n');

      editor.setComponents(tagMediaWithPids(withoutStyles));
      if (mergedCss) editor.setStyle(mergedCss);

      if (mergedCss !== sourceCss) onSaveCss?.(mergedCss);
      if (headContent !== headContentRef.current) {
        headContentRef.current = headContent;
        onSaveHeadContent?.(headContent);
      }
      if (mergedScripts !== bodyScriptsRef.current) {
        bodyScriptsRef.current = mergedScripts;
        onSaveBodyScripts?.(mergedScripts);
      }
    },
    [sourceCss, onSaveCss, onSaveHeadContent, onSaveBodyScripts],
  );

  return (
    <div className="relative h-full w-full">
      {!isEditorReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ds-app">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-ds-line border-t-ds-ink rounded-full mx-auto mb-3" />
            <p className="text-ds-muted text-[12.5px]">Loading editor...</p>
          </div>
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />

      {agentTarget && (
        <>
          <ImageAiOverlay editorRef={editorRef} containerRef={containerRef} pageId={pageId} />
          {createPortal(
            <GrapesJSAgentPanel pageId={pageId} editorRef={editorRef} />,
            agentTarget,
          )}
        </>
      )}

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
        isLoading={isImporting}
        error={importError}
      />
      <SourceEditorModal
        isOpen={isSourceOpen}
        onClose={() => setIsSourceOpen(false)}
        html={sourceHtml}
        css={sourceCss}
        headContent={headContentRef.current}
        bodyScripts={bodyScriptsRef.current}
        onApply={handleApplySource}
      />
    </div>
  );
});

GrapesJSEditor.displayName = 'GrapesJSEditor';

export default GrapesJSEditor;
