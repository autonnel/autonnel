import React, { useState, useCallback, useMemo, lazy, Suspense, useRef } from 'react';
import type { Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { EditorWrapper } from './builder/EditorWrapper';
import type { GrapesJSEditorRef } from './GrapesJSEditor';
import { Button as DsButton, Drawer as DsDrawer } from './primitives/ds';
import { ImagePromptsProvider } from './grapesjs/ImagePromptsContext';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { UpdatePageInputDto } from '@/contracts/pages';
import type { PageMeta, Page, PageEditorProps, SaveStatus, SettingsPanelProps } from './page-editor/types';
import { SaveStatusIndicator } from './page-editor/SaveStatusIndicator';
import { PreviewDropdown } from './page-editor/PreviewDropdown';
import { SettingsPanel } from './page-editor/SettingsPanel';
import { checkHasUnpublishedChanges } from './page-editor/checkHasUnpublishedChanges';
import { ICON_BACK, ICON_SETTINGS } from './page-editor/icons';

const GrapesJSEditor = lazy(() => import('./GrapesJSEditor'));

export default function PageEditor({ page: initialPage }: PageEditorProps) {
  const [page, setPage] = useState(initialPage);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(() => checkHasUnpublishedChanges(initialPage));

  const [meta, setMeta] = useState<PageMeta>({
    title: page.meta?.title || page.name,
    description: page.meta?.description || '',
  });
  const [pageName, setPageName] = useState(page.name || '');
  const [slug, setSlug] = useState(page.slug || '');
  const [slugError, setSlugError] = useState('');
  const [settingsSaveState, setSettingsSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [headContent, setHeadContent] = useState((page.settings as any)?.headContent || '');
  const [bodyScripts, setBodyScripts] = useState((page.settings as any)?.bodyScripts || '');

  const grapesEditorRef = useRef<GrapesJSEditorRef>(null);

  type PendingSave = {
    draftData?: Data;
    htmlContent?: string;
    cssContent?: string;
    headContent?: string;
    bodyScripts?: string;
    editorProjectData?: any;
    imagePrompts?: Record<string, string>;
  };

  const pendingSaveRef = useRef<PendingSave>({});
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inflightSaveRef = useRef<Promise<void> | null>(null);
  const latestSettingsRef = useRef<Record<string, any>>(
    (initialPage.draftSettings ?? initialPage.settings) || {}
  );

  const initialData = useMemo(() => {
    const generateId = () => `puck-${Math.random().toString(36).substr(2, 9)}`;
    const ensureIds = (data: Data): Data => ({
      ...data,
      content: data.content.map((item: any) => ({
        ...item,
        props: { ...item.props, id: item.props?.id || generateId() },
      })),
    });
    if (page.draftData && (page.draftData as any).content) return ensureIds(page.draftData);
    return ensureIds({ root: { props: {} }, content: [], zones: {} } as Data);
  }, [page]);

  const currentDataRef = React.useRef<Data | null>(null);

  React.useEffect(() => {
    latestSettingsRef.current = page.settings || {};
  }, [page.settings]);

  React.useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, []);

  const doFlush = useCallback(async (): Promise<void> => {
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = {};

    const payload: UpdatePageInputDto = {};
    if (pending.draftData !== undefined) payload.draftData = pending.draftData;
    if (pending.htmlContent !== undefined) payload.htmlContent = pending.htmlContent;

    const settingsUpdates: Record<string, any> = {};
    if (pending.cssContent !== undefined) settingsUpdates.cssContent = pending.cssContent;
    if (pending.headContent !== undefined) settingsUpdates.headContent = pending.headContent;
    if (pending.bodyScripts !== undefined) settingsUpdates.bodyScripts = pending.bodyScripts;
    if (pending.editorProjectData !== undefined) settingsUpdates.editorProjectData = pending.editorProjectData;
    if (pending.imagePrompts !== undefined) settingsUpdates.imagePrompts = pending.imagePrompts;
    const hasSettings = Object.keys(settingsUpdates).length > 0;

    if (Object.keys(payload).length === 0 && !hasSettings) {
      setSaveStatus('saved');
      return;
    }

    let mergedSettings: Record<string, any> | null = null;
    if (hasSettings) {
      mergedSettings = { ...latestSettingsRef.current, ...settingsUpdates };
      payload.settings = mergedSettings;
    }

    try {
      await apiCall('PUT /api/page/:pageId', payload, { params: { pageId: page.id } });
      if (mergedSettings) {
        latestSettingsRef.current = mergedSettings;
        setPage((prev) => ({ ...prev, settings: mergedSettings! }));
      }
    } catch (err) {
      console.error('Save error:', err);
      pendingSaveRef.current = { ...pending, ...pendingSaveRef.current };
      setSaveStatus('error');
      setSaveErrorMsg(err instanceof ApiCallError ? err.message : 'Network error');
      return;
    }

    if (Object.keys(pendingSaveRef.current).length > 0) {
      return doFlush();
    }
    setSaveStatus('saved');
  }, [page.id]);

  const flushSave = useCallback((): Promise<void> => {
    if (inflightSaveRef.current) return inflightSaveRef.current;
    const promise = doFlush().finally(() => {
      if (inflightSaveRef.current === promise) inflightSaveRef.current = null;
    });
    inflightSaveRef.current = promise;
    return promise;
  }, [doFlush]);

  const scheduleSave = useCallback((changes: PendingSave) => {
    pendingSaveRef.current = { ...pendingSaveRef.current, ...changes };
    setSaveStatus('saving');
    setSaveErrorMsg('');
    setHasUnpublishedChanges(true);

    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = setTimeout(() => {
      flushTimeoutRef.current = null;
      void flushSave();
    }, 1000);
  }, [flushSave]);

  const handleSave = useCallback((data: Data) => {
    currentDataRef.current = data;
    scheduleSave({ draftData: data });
  }, [scheduleSave]);

  const handleManualSave = useCallback(async () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    if (page.editorType === 'HTML') {
      const content = grapesEditorRef.current?.getContent?.();
      if (content) {
        const next: PendingSave = { ...pendingSaveRef.current };
        if (content.html !== undefined) next.htmlContent = content.html;
        if (content.css !== undefined) next.cssContent = content.css;
        if (content.editorData !== undefined) next.editorProjectData = content.editorData;
        pendingSaveRef.current = next;
      }
    } else if (currentDataRef.current) {
      pendingSaveRef.current = { ...pendingSaveRef.current, draftData: currentDataRef.current };
    }

    setSaveStatus('saving');
    setSaveErrorMsg('');
    setHasUnpublishedChanges(true);

    await flushSave();
  }, [page.editorType, flushSave]);

  const handleSaveSettings = async () => {
    setSlugError('');
    setSettingsSaveState('saving');
    const payload: UpdatePageInputDto = { meta };

    if (pageName !== page.name) {
      if (!pageName.trim()) {
        setSettingsSaveState('idle');
        return;
      }
      payload.name = pageName.trim();
    }

    if (slug !== page.slug) {
      if (!slug && slug !== '/') {
        setSlugError('Slug is required');
        setSettingsSaveState('idle');
        return;
      }
      payload.slug = slug;
    }

    if (page.editorType !== 'HTML') {
      const currentSettings = page.settings || {};
      payload.settings = { ...currentSettings as any, headContent, bodyScripts };
    }

    try {
      const updated = await apiCall('PUT /api/page/:pageId', payload, { params: { pageId: page.id } });
      setPage({ ...page, name: payload.name || page.name, meta, slug: updated.slug, settings: (payload.settings as Page['settings']) || page.settings });
      setSettingsSaveState('saved');
      setHasUnpublishedChanges(true);
      setTimeout(() => setSettingsSaveState('idle'), 2000);
    } catch (err) {
      if (err instanceof ApiCallError && err.message.includes('Slug already exists')) {
        setSlugError('This slug is already used by another page in this site');
        setSettingsSaveState('idle');
        return;
      }
      console.error('Save settings error:', err);
      setSettingsSaveState('idle');
      alert('Failed to save settings');
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await apiCall('PUT /api/page/:pageId', {
        status: 'PUBLISHED',
        publishedData: currentDataRef.current || page.draftData,
        meta,
      }, { params: { pageId: page.id } });
      setPage({
        ...page,
        status: 'PUBLISHED',
        publishedData: currentDataRef.current || page.draftData,
        meta,
      });
      setHasUnpublishedChanges(false);
    } catch (err) {
      alert('Failed to publish page');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscard = useCallback(async () => {
    if (!window.confirm('Discard all unpublished changes and revert to the published version? This cannot be undone.')) {
      return;
    }
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    // Let any in-flight autosave settle first so the discard write is the last one to land.
    if (inflightSaveRef.current) {
      try { await inflightSaveRef.current; } catch { /* ignore */ }
    }
    pendingSaveRef.current = {};

    setIsDiscarding(true);
    try {
      const payload: UpdatePageInputDto =
        page.editorType === 'HTML'
          ? { draftHtml: page.htmlContent ?? '', draftSettings: page.settings ?? {} }
          : { draftData: page.publishedData };
      await apiCall('PUT /api/page/:pageId', payload, { params: { pageId: page.id } });
      window.location.reload();
    } catch (err) {
      setIsDiscarding(false);
      alert('Failed to discard changes');
    }
  }, [page]);

  const handleSaveHtml = useCallback((html: string, css: string, editorData?: any) => {
    scheduleSave({ htmlContent: html, cssContent: css, editorProjectData: editorData });
  }, [scheduleSave]);

  const handleSaveHeadContent = useCallback((headContent: string) => {
    scheduleSave({ headContent });
  }, [scheduleSave]);

  const handleSaveCss = useCallback((cssContent: string) => {
    scheduleSave({ cssContent });
  }, [scheduleSave]);

  const handleSaveBodyScripts = useCallback((bodyScripts: string) => {
    scheduleSave({ bodyScripts });
  }, [scheduleSave]);

  const handlePublishHtml = async () => {
    setIsPublishing(true);
    try {
      await handleManualSave();
      const updated = await apiCall('PUT /api/page/:pageId', { status: 'PUBLISHED', meta }, { params: { pageId: page.id } });
      setPage((prev) => ({
        ...prev,
        status: 'PUBLISHED',
        meta,
        htmlContent: updated.htmlContent ?? prev.htmlContent,
        settings: (updated.settings as Page['settings']) ?? prev.settings,
        draftHtml: updated.draftHtml ?? prev.draftHtml,
        draftSettings: (updated.draftSettings as Page['draftSettings']) ?? prev.draftSettings,
      }));
      if (updated.settings) latestSettingsRef.current = updated.settings as Record<string, unknown>;
      setHasUnpublishedChanges(false);
    } catch (err) {
      alert('Failed to publish page');
    } finally {
      setIsPublishing(false);
    }
  };

  const headerLeft = (
    <div className="flex items-center gap-3 min-w-0">
      <DsButton variant="ghost" size="sm" asChild>
        <a href="/pages" aria-label="Back to pages">{ICON_BACK}</a>
      </DsButton>
      <span className="font-semibold text-ds-ink text-[13.5px] truncate">{page.name}</span>
      <span className="text-ds-muted text-[12px] font-ds-mono tabular truncate">
        {page.slug === '/' ? '/ (homepage)' : `/${page.slug}`}
      </span>
    </div>
  );

  const settingsPanelProps: SettingsPanelProps = {
    pageName, setPageName, slug, setSlug, slugError, setSlugError,
    meta, setMeta,
    showCustomScripts: page.editorType !== 'HTML',
    headContent, setHeadContent, bodyScripts, setBodyScripts,
    settingsSaveState, onSave: handleSaveSettings,
  };

  const needsPublish = page.status !== 'PUBLISHED' || hasUnpublishedChanges;
  const canDiscard = page.status === 'PUBLISHED' && hasUnpublishedChanges;

  const publishLabel = (label: string) => (
    <>
      {needsPublish && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5"
          aria-label="Unpublished changes"
        />
      )}
      {label}
    </>
  );

  const pageSettingsDrawer = (
    <DsDrawer
      open={pageSettingsOpen}
      onClose={() => setPageSettingsOpen(false)}
      title="Page Settings"
      widthClass="w-full sm:w-full lg:w-[560px]"
    >
      <SettingsPanel {...settingsPanelProps} embedded />
    </DsDrawer>
  );

  if (page.editorType === 'HTML') {
    return (
      <div className="h-screen flex flex-col bg-ds-app">
        <header className="border-b border-ds-line bg-ds-card px-4 py-2.5 flex items-center justify-between flex-shrink-0 gap-3">
          {headerLeft}
          <div className="flex items-center gap-2">
            <SaveStatusIndicator saveStatus={saveStatus} saveErrorMsg={saveErrorMsg} onRetry={handleManualSave} />
            <DsButton size="sm" leftIcon={ICON_SETTINGS} onClick={() => setPageSettingsOpen(true)}>
              Page Settings
            </DsButton>
            <PreviewDropdown slug={page.slug} canDiscard={canDiscard} discarding={isDiscarding} onDiscard={handleDiscard} />
            <DsButton variant="primary" size="sm" onClick={handlePublishHtml} disabled={isPublishing}>
              {publishLabel(isPublishing ? 'Publishing...' : 'Publish')}
            </DsButton>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center text-ds-ink">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-ds-line border-t-ds-ink rounded-full mx-auto mb-3"></div>
                <p className="text-ds-muted text-[12.5px]">Loading editor...</p>
              </div>
            </div>
          }>
            <ImagePromptsProvider
              initial={((page.draftSettings ?? page.settings) as { imagePrompts?: Record<string, string> } | null)?.imagePrompts ?? {}}
              onChange={(next) => scheduleSave({ imagePrompts: next })}
            >
              <GrapesJSEditor
                ref={grapesEditorRef}
                initialContent={page.draftHtml ?? page.htmlContent ?? ''}
                initialCss={((page.draftSettings ?? page.settings) as any)?.cssContent || ''}
                initialHeadContent={((page.draftSettings ?? page.settings) as any)?.headContent || ''}
                initialBodyScripts={((page.draftSettings ?? page.settings) as any)?.bodyScripts || ''}
                initialEditorData={((page.draftSettings ?? page.settings) as any)?.editorProjectData}
                onSave={handleSaveHtml}
                onSaveCss={handleSaveCss}
                onSaveHeadContent={handleSaveHeadContent}
                onSaveBodyScripts={handleSaveBodyScripts}
                saveStatus={saveStatus}
                pageId={page.id}
              />
            </ImagePromptsProvider>
          </Suspense>
        </div>

        {pageSettingsDrawer}
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-ds-app" style={{ height: '100vh' }}>
      <header className="border-b border-ds-line bg-ds-card px-4 py-2.5 flex items-center justify-between flex-shrink-0 gap-3">
        {headerLeft}
        <div className="flex items-center gap-2">
          <SaveStatusIndicator saveStatus={saveStatus} saveErrorMsg={saveErrorMsg} onRetry={handleManualSave} />
          <PreviewDropdown slug={page.slug} canDiscard={canDiscard} discarding={isDiscarding} onDiscard={handleDiscard} />
          <DsButton variant="primary" size="sm" onClick={handlePublish} disabled={isPublishing}>
            {publishLabel(isPublishing ? 'Publishing...' : 'Publish')}
          </DsButton>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <EditorWrapper
          initialData={initialData}
          planId={page.id}
          onSave={handleSave}
          saveStatus={saveStatus}
          settingsPanel={<SettingsPanel {...settingsPanelProps} embedded />}
        />
      </div>
    </div>
  );
}
