import { useEffect, useRef, useState, useCallback } from 'react';
import type { EmailTemplateType } from '@/lib/email-templates/types';
import { Save, Info, Copy } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/primitives/DropdownMenu';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/primitives/Select';
import { toast } from '@/components/primitives/ds';
import { apiCall, ApiCallError } from '@/lib/api/client';

interface Variable {
  key: string;
  label: string;
  category?: string;
  example?: string;
}

interface Props {
  templateType: EmailTemplateType;
  language: 'en' | 'fr' | 'de' | 'es';
  initialData: { name: string; subject: string; design: unknown; content: string };
  availableVariables: Variable[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface LoadedModules {
  EmailEditorProvider: AnyFn;
  EmailEditor: React.ComponentType;
  StandardLayout: React.ComponentType<{
    children?: React.ReactNode;
    showSourceCode?: boolean;
    categories: Array<{
      label: string;
      active?: boolean;
      blocks: Array<{ type: string; payload?: unknown; title?: string }>;
      displayType?: 'grid';
    }>;
  }>;
  JsonToMjml: AnyFn;
  mjmlBrowser: AnyFn;
  BasicType: Record<string, string>;
  BlockManager: { getBlockByType: (type: string) => unknown };
}

// easy-email hardcodes 360px left + 350px right siders; shrink both to 280px.
// The block-item margin override neutralizes easy-email's nth-child(3n+1) rule.
const EDITOR_HOST_STYLE = `
.email-editor-host,
.email-editor-host .arco-card,
.email-editor-host .arco-card-body {
  height: 100% !important;
  min-height: 0 !important;
}
.email-editor-host .arco-layout-has-sider > .arco-layout {
  overflow-x: auto !important;
}
.email-editor-host .arco-layout > aside.arco-layout-sider:not(.arco-layout-sider-collapsed) {
  min-width: 280px !important;
  max-width: 280px !important;
  width: 280px !important;
  flex: 0 0 280px !important;
}
.email-editor-host aside.arco-layout-sider [class*="blockItem"]:not([class*="Container"]) {
  margin-left: 10px !important;
  margin-right: 10px !important;
  margin-bottom: 12px !important;
}
`;

const CHROME_OUTSIDE_HOST = 52 + 16 + 16;
const FALLBACK_CHROME_CONTENT_HEIGHT = 56;

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];

const HIDE_LABELS = new Set(['SubTitle']);

function buildCategories(BasicType: Record<string, string>) {
  return [
    {
      label: 'Content',
      active: true,
      displayType: 'grid' as const,
      blocks: [
        { type: BasicType.TEXT, title: 'Text' },
        { type: BasicType.IMAGE, title: 'Image' },
        { type: BasicType.BUTTON, title: 'Button' },
        { type: BasicType.DIVIDER, title: 'Divider' },
        { type: BasicType.SPACER, title: 'Spacer' },
        { type: BasicType.SOCIAL, title: 'Social' },
        { type: BasicType.NAVBAR, title: 'Navbar' },
      ],
    },
    {
      label: 'Layout',
      displayType: 'grid' as const,
      blocks: [
        { type: BasicType.SECTION, title: 'Section' },
        { type: BasicType.COLUMN, title: 'Column' },
        { type: BasicType.WRAPPER, title: 'Wrapper' },
        { type: BasicType.HERO, title: 'Hero' },
      ],
    },
  ];
}

export default function EmailTemplateEditor({
  templateType,
  language,
  initialData,
  availableVariables,
}: Props) {
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewportNarrow, setViewportNarrow] = useState(false);
  const [chromeContentHeight, setChromeContentHeight] = useState(FALLBACK_CHROME_CONTENT_HEIGHT);

  const isDirtyRef = useRef(false);
  const latestDesignRef = useRef<unknown>(initialData.design);
  const latestSubjectRef = useRef<string>(initialData.subject);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setViewportNarrow(window.innerWidth < 800);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const measure = () => setChromeContentHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [easyEmailMod, easyEmailExtMod, easyEmailCoreMod, mjmlMod] = await Promise.all([
          import('easy-email-editor'),
          import('easy-email-extensions'),
          import('easy-email-core'),
          import('mjml-browser'),
          // arco.css must load before easy-email styles
          import('@arco-design/web-react/dist/css/arco.css' as string).catch(() => null),
          import('easy-email-editor/lib/style.css' as string).catch(() => null),
          import('easy-email-extensions/lib/style.css' as string).catch(() => null),
        ]);
        if (!cancelled) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyCoreMod = easyEmailCoreMod as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyMjmlMod = mjmlMod as any;
          setModules({
            EmailEditorProvider: easyEmailMod.EmailEditorProvider as AnyFn,
            EmailEditor: easyEmailMod.EmailEditor,
            StandardLayout: easyEmailExtMod.StandardLayout as LoadedModules['StandardLayout'],
            JsonToMjml: anyCoreMod.JsonToMjml as AnyFn,
            mjmlBrowser: (anyMjmlMod.default ?? anyMjmlMod) as AnyFn,
            BasicType: anyCoreMod.BasicType as Record<string, string>,
            BlockManager: anyCoreMod.BlockManager,
          });
        }
      } catch (err) {
        console.error('Failed to load email editor modules', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!modules) return;
    const target = document.querySelector('.email-editor-host');
    if (!target) return;

    const hideLabels = () => {
      target.querySelectorAll('label').forEach((el) => {
        const text = el.textContent?.trim() ?? '';
        if (HIDE_LABELS.has(text)) {
          const formItem = el.closest('.arco-form-item') as HTMLElement | null;
          if (formItem) formItem.style.display = 'none';
        }
      });
    };

    hideLabels();
    const mo = new MutationObserver(hideLabels);
    mo.observe(target, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [modules]);

  const handleLangChange = useCallback((newLang: string) => {
    if (newLang === language) return;
    if (isDirtyRef.current) {
      const ok = window.confirm('You have unsaved changes. Switch language without saving?');
      if (!ok) return;
    }
    window.location.href = `/settings/email-templates/${templateType}/${newLang}/edit`;
  }, [language, templateType]);

  const handleCopyVar = useCallback((key: string) => {
    const snippet = `{{${key}}}`;
    navigator.clipboard.writeText(snippet).then(() => {
      toast.success(`Copied ${snippet}`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!modules) return;
    setSaving(true);
    try {
      const design = latestDesignRef.current;
      const mjmlStr = modules.JsonToMjml({ data: design, mode: 'production', context: design });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = modules.mjmlBrowser(mjmlStr, { validationLevel: 'soft' }) as any;
      if (result.errors && result.errors.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstErr = result.errors[0] as any;
        toast.error(`MJML errors: ${firstErr.formattedMessage ?? firstErr.message}`);
        return;
      }
      const html = result.html as string;

      try {
        await apiCall('POST /api/settings/email-templates', {
          templateType,
          name: initialData.name,
          subject: latestSubjectRef.current,
          design,
          content: html,
          language,
          isActive: true,
        });
      } catch (postErr) {
        if (postErr instanceof ApiCallError) {
          toast.error(postErr.message);
          return;
        }
        throw postErr;
      }
      isDirtyRef.current = false;
      toast.success('Template saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [modules, templateType, language, initialData.name]);

  const mergeTags = availableVariables.reduce<Record<string, string>>((acc, v) => {
    acc[v.key] = v.example ?? '';
    return acc;
  }, {});

  const varsByCategory = availableVariables.reduce<Record<string, Variable[]>>((acc, v) => {
    const cat = v.category ?? 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  if (viewportNarrow) {
    return (
      <div className="flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Please use a desktop browser (≥ 800px wide) to edit email templates.
      </div>
    );
  }

  return (
    <div className="flex flex-col px-8 pt-4 pb-4" style={{ height: `calc(100vh - 52px)` }}>
      <style>{EDITOR_HOST_STYLE}</style>


      <div ref={headerRef} className="flex items-center gap-3 px-0 pb-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ds-ink truncate">{initialData.name}</div>
          <div className="text-xs text-muted-foreground">{templateType} · {language}</div>
        </div>


        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Info className="h-4 w-4" />
              Variables
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 overflow-y-auto w-64" align="end">
            {Object.entries(varsByCategory).map(([cat, vars], idx) => (
              <div key={cat}>
                {idx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">{cat}</DropdownMenuLabel>
                {vars.map((v) => (
                  <DropdownMenuItem
                    key={v.key}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    onSelect={() => handleCopyVar(v.key)}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono truncate">{`{{${v.key}}}`}</div>
                      <div className="text-xs text-muted-foreground truncate">{v.label}</div>
                    </div>
                    <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>


        <Select value={language} onValueChange={handleLangChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          disabled={!modules || saving}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>


      <div className="email-editor-host flex-1 min-h-0">
        {!modules ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading editor…
          </div>
        ) : (
          <EasyEmailCanvas
            modules={modules}
            design={initialData.design}
            initialSubject={initialData.subject}
            mergeTags={mergeTags}
            latestDesignRef={latestDesignRef}
            latestSubjectRef={latestSubjectRef}
            isDirtyRef={isDirtyRef}
            chromeOutsideHost={CHROME_OUTSIDE_HOST + chromeContentHeight}
          />
        )}
      </div>
    </div>
  );
}

interface CanvasProps {
  modules: LoadedModules;
  design: unknown;
  initialSubject: string;
  mergeTags: Record<string, string>;
  latestDesignRef: React.MutableRefObject<unknown>;
  latestSubjectRef: React.MutableRefObject<string>;
  isDirtyRef: React.MutableRefObject<boolean>;
  chromeOutsideHost: number;
}

function EasyEmailCanvas({
  modules,
  design,
  initialSubject,
  mergeTags,
  latestDesignRef,
  latestSubjectRef,
  isDirtyRef,
  chromeOutsideHost,
}: CanvasProps) {
  const EmailEditorProvider = modules.EmailEditorProvider;
  const EmailEditor = modules.EmailEditor;
  const StandardLayout = modules.StandardLayout;
  const categories = buildCategories(modules.BasicType);
  const editorHeight = `calc(100vh - ${chromeOutsideHost}px)`;

  return (
    <EmailEditorProvider
      data={{ subject: initialSubject, subTitle: '', content: design }}
      height={editorHeight}
      mergeTags={mergeTags}
      mergeTagGenerate={(tag: string) => `{{${tag}}}`}
      enabledMergeTagsBadge
      onChangeMergeTag={() => {}}
      autoComplete
    >
      {(formState: { values?: { content?: unknown; subject?: string } }) => {
        const content = formState?.values?.content;
        if (content !== undefined) {
          const prev = latestDesignRef.current;
          if (JSON.stringify(prev) !== JSON.stringify(content)) {
            latestDesignRef.current = content;
            isDirtyRef.current = true;
          }
        }
        const nextSubject = formState?.values?.subject;
        if (typeof nextSubject === 'string' && nextSubject !== latestSubjectRef.current) {
          latestSubjectRef.current = nextSubject;
          isDirtyRef.current = true;
        }
        return (
          <StandardLayout showSourceCode={false} categories={categories}>
            <EmailEditor />
          </StandardLayout>
        );
      }}
    </EmailEditorProvider>
  );
}
