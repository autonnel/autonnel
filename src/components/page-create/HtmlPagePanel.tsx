import React, { useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractErrorMessage, slugifyName, randomSlugSuffix, applySlugSuffix, type PanelProps } from './shared';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { PageDetailDto } from '@/contracts/pages';
import { Input, dsFieldLabelClass, dsFieldHintClass } from '@/components/primitives';

type Mode = 'blank' | 'import';

interface NewPageFields {
  name: string;
  slug: string;
  url: string;
}

const MODES: ReadonlyArray<{ v: Mode; label: string }> = [
  { v: 'blank', label: 'Blank' },
  { v: 'import', label: 'Clone Webpage' },
];

const FIELD_LABEL = dsFieldLabelClass;
const FIELD_HINT = dsFieldHintClass;

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function HtmlPagePanel({
  onCancel,
  onBack,
  onCreated,
  redirectAfterCreate,
}: PanelProps) {
  const [mode, setMode] = useState<Mode>('blank');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [importWarning, setImportWarning] = useState('');
  const [slugSuffix] = useState(() => randomSlugSuffix());

  const [fields, setFields] = useState<NewPageFields>({ name: '', slug: '', url: '' });

  const createBlankHtmlPage = async (): Promise<PageDetailDto> => {
    try {
      return await apiCall('POST /api/page', {
        name: fields.name,
        slug: fields.slug,
        type: 'custom',
        editorType: 'HTML',
      });
    } catch (err) {
      throw new Error(err instanceof ApiCallError ? err.message : 'Failed to create page');
    }
  };

  const importHtmlFromUrl = async (pageId: string): Promise<string> => {
    const res = await fetch(`/api/page/${pageId}/import-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fields.url }),
    });
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res, 'Failed to import URL'));
    }
    const data = (await res.json()) as { html?: string };
    return data.html ?? '';
  };

  const savePageHtml = async (pageId: string, html: string): Promise<void> => {
    try {
      await apiCall('PUT /api/page/:pageId', { htmlContent: html }, { params: { pageId } });
    } catch (err) {
      throw new Error(err instanceof ApiCallError ? err.message : 'Failed to save imported HTML');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.name || !fields.slug) return;
    if (mode === 'import' && !isValidHttpUrl(fields.url)) {
      setErrorMessage('Please enter a valid http(s) URL');
      return;
    }
    setIsCreating(true);
    setErrorMessage('');
    setImportWarning('');

    try {
      const page = await createBlankHtmlPage();

      if (mode === 'import') {
        try {
          const html = await importHtmlFromUrl(page.id);
          await savePageHtml(page.id, html);
        } catch (importErr) {
          const msg = importErr instanceof Error ? importErr.message : String(importErr);
          setImportWarning(`Import did not complete: ${msg}. Opening the empty page in the editor.`);
        }
      }

      onCreated(page);
      if (redirectAfterCreate) window.location.href = `/page/${page.id}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create page';
      setErrorMessage(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const submitDisabled =
    isCreating || !fields.name || !fields.slug || (mode === 'import' && !fields.url);

  return (
    <div data-testid="html-page-panel">
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          data-testid="panel-back"
          onClick={onBack}
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-[7px] text-ds-slate hover:text-ds-ink hover:bg-ds-surface2"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div
          role="tablist"
          className="inline-flex bg-ds-surface2 border border-ds-line rounded-[8px] p-0.5"
        >
          {MODES.map(({ v, label }) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={mode === v}
              onClick={() => setMode(v)}
              className={cn(
                'inline-flex items-center justify-center px-3 h-7 text-[12.5px] font-medium rounded-[6px] transition-colors',
                mode === v
                  ? 'bg-ds-card text-ds-ink shadow-[0_1px_2px_rgba(17,24,39,0.06)]'
                  : 'text-ds-muted hover:text-ds-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'import' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="html-source-url" className={FIELD_LABEL}>
              Source URL
            </label>
            <Input
              id="html-source-url"
              type="url"
              value={fields.url}
              onChange={(e) => setFields({ ...fields, url: e.target.value })}
              placeholder="https://example.com/landing"
              required
            />
            <span className={FIELD_HINT}>
              We'll fetch the page, rewrite assets to your CDN, and open it in the HTML editor.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="html-page-name" className={FIELD_LABEL}>
            Page Name
          </label>
          <Input
            id="html-page-name"
            type="text"
            value={fields.name}
            onChange={(e) => {
              const name = e.target.value;
              setFields({ ...fields, name, slug: applySlugSuffix(slugifyName(name), slugSuffix) });
            }}
            placeholder="My Landing Page"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="html-page-slug" className={FIELD_LABEL}>
            Slug
          </label>
          <Input
            id="html-page-slug"
            type="text"
            value={fields.slug}
            onChange={(e) => {
              const val = e.target.value.toLowerCase();
              if (val === '/' || val === '') {
                setFields({ ...fields, slug: val });
              } else {
                setFields({ ...fields, slug: val.replace(/[^a-z0-9-]/g, '-') });
              }
            }}
            placeholder="my-landing-page or / for homepage"
            required
          />
          <span className={FIELD_HINT}>
            {fields.slug === '/' ? 'Homepage (root)' : `URL: /${fields.slug || 'page-slug'}`}
          </span>
        </div>

        {importWarning && (
          <div className="text-[12.5px] text-[#92400E] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] rounded-[6px] px-3 py-2">
            {importWarning}
          </div>
        )}

        {errorMessage && (
          <div className="text-[12.5px] text-[#B91C1C] bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.2)] rounded-[6px] px-3 py-2">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="inline-flex items-center justify-center gap-1.5 font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink border border-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === 'import' ? 'Clone & Create' : 'Create Page'}
          </button>
        </div>
      </form>
    </div>
  );
}
