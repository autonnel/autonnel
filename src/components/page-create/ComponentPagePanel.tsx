import React, { useState } from 'react';
import { Loader2, ArrowLeft, LayoutTemplate } from 'lucide-react';
import { getTemplatesBySection, type TemplateDescriptor } from '@/lib/templates';
import { cn } from '@/lib/utils';
import { SECTION_META, slugifyName, randomSlugSuffix, applySlugSuffix, type PanelProps } from './shared';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { PageTypeInput } from '@/contracts/pages';
import { Input, dsFieldLabelClass, dsFieldHintClass } from '@/components/primitives';
import MarketplaceSection from './MarketplaceSection';

const FIELD_LABEL = dsFieldLabelClass;
const FIELD_HINT = dsFieldHintClass;

export default function ComponentPagePanel({
  onCancel,
  onBack,
  onCreated,
  redirectAfterCreate,
  defaultPageType,
}: PanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [slugSuffix] = useState(() => randomSlugSuffix());

  const [newPage, setNewPage] = useState({
    name: '',
    slug: '',
    type: defaultPageType || 'CUSTOM',
    templateType: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPage.name || !newPage.slug) return;
    setIsCreating(true);
    setErrorMessage('');

    try {
      const page = await apiCall('POST /api/page', {
        name: newPage.name,
        slug: newPage.slug,
        type: newPage.type.toLowerCase() as PageTypeInput,
        editorType: 'PUCK',
        templateName: newPage.templateType,
      });
      onCreated(page);
      if (redirectAfterCreate) {
        window.location.href = `/page/${page.id}`;
      }
    } catch (err) {
      setErrorMessage(
        err instanceof ApiCallError ? err.message : 'Failed to create page. Please check your network and try again.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div data-testid="component-page-panel">
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
        <h2 className="text-[14px] font-semibold text-ds-ink">Choose Template</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          {(['funnel', 'store', 'utility'] as const).map((section) => {
            const templates = getTemplatesBySection(section);
            if (templates.length === 0) return null;
            const meta = SECTION_META[section];
            return (
              <div key={section} className="mb-6 last:mb-0">
                <div className="sticky top-0 bg-ds-card z-10 pb-2 border-b border-ds-line mb-3">
                  <h3 className="text-[13px] font-semibold text-ds-ink">
                    {meta.title}{' '}
                    <span className="text-ds-muted font-normal">({templates.length})</span>
                  </h3>
                  <p className="text-[11.5px] text-ds-muted mt-0.5">{meta.subtitle}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {templates.map((t: TemplateDescriptor) => (
                    <button
                      key={t.value}
                      type="button"
                      data-testid={`template-card-${section}`}
                      onClick={() =>
                        setNewPage({
                          ...newPage,
                          templateType: t.value,
                          type: t.defaultPageType,
                          name: t.label,
                          slug: applySlugSuffix(
                            t.defaultSlug ?? t.value.toLowerCase().replace(/_/g, '-'),
                            slugSuffix,
                          ),
                        })
                      }
                      className={cn(
                        'rounded-[10px] border bg-ds-card transition-all cursor-pointer overflow-hidden text-left',
                        newPage.templateType === t.value
                          ? 'border-ds-ink ring-2 ring-ds-ink/15'
                          : 'border-ds-line hover:border-ds-slate',
                      )}
                    >
                      <div className="aspect-[4/5] bg-ds-surface2 flex items-center justify-center overflow-hidden">
                        {t.thumbnail ? (
                          <img
                            src={t.thumbnail}
                            alt={t.label}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        ) : (
                          <LayoutTemplate className="w-10 h-10 text-ds-faint" aria-hidden="true" />
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="text-[12.5px] font-medium text-ds-ink line-clamp-1">
                          {t.label}
                        </div>
                        <div className="text-[11.5px] text-ds-muted mt-0.5 line-clamp-2">
                          {t.subtitle}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <MarketplaceSection />
        </div>

        <div className="sticky bottom-0 z-20 -mx-6 -mb-6 px-6 pt-4 pb-6 bg-ds-card border-t border-ds-line flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="puck-page-name" className={FIELD_LABEL}>
              Page Name
            </label>
            <Input
              id="puck-page-name"
              type="text"
              value={newPage.name}
              onChange={(e) => {
                const name = e.target.value;
                setNewPage({ ...newPage, name, slug: applySlugSuffix(slugifyName(name), slugSuffix) });
              }}
              placeholder="My Landing Page"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="puck-page-slug" className={FIELD_LABEL}>
              Slug
            </label>
            <Input
              id="puck-page-slug"
              type="text"
              value={newPage.slug}
              onChange={(e) => {
                const val = e.target.value.toLowerCase();
                if (val === '/' || val === '') {
                  setNewPage({ ...newPage, slug: val });
                } else {
                  setNewPage({ ...newPage, slug: val.replace(/[^a-z0-9-]/g, '-') });
                }
              }}
              placeholder="my-landing-page or / for homepage"
              required
            />
            <span className={FIELD_HINT}>
              {newPage.slug === '/' ? 'Homepage (root)' : `URL: /${newPage.slug || 'page-slug'}`}
            </span>
          </div>

          {errorMessage && (
            <div className="text-[12.5px] text-[#B91C1C] bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.2)] rounded-[6px] px-3 py-2">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !newPage.templateType}
              className="inline-flex items-center justify-center gap-1.5 font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink border border-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Page
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
