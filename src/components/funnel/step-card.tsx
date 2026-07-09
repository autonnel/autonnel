import React, { useCallback, useState } from 'react';
import {
  Loader2,
  Copy,
  Check,
  Trash2,
  Settings as SettingsIcon,
  Replace,
  GripVertical,
  Rocket,
  ShoppingCart,
  PartyPopper,
  TrendingUp,
  TriangleAlert,
  FileText,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import type { FunnelPage, FunnelValidationError } from './types';
import { PAGE_TYPE_LABELS } from './types';

const PAGE_TYPE_ICON: Record<string, LucideIcon> = {
  LANDING: Rocket,
  CHECKOUT: ShoppingCart,
  THANKYOU: PartyPopper,
  UPSELL: TrendingUp,
  ERROR: TriangleAlert,
};
import { Button as DsButton, Badge as DsBadge } from '../primitives/ds';
import { Input } from '../primitives';

export interface FunnelPageCardProps {
  funnelPage: FunnelPage;
  funnelId: string;
  landingPages: FunnelPage[];
  canReorder: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  validationError?: FunnelValidationError;
  onDragStart: (e: React.DragEvent, funnelPage: FunnelPage) => void;
  onDragOver: (e: React.DragEvent, funnelPage: FunnelPage) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, funnelPage: FunnelPage) => void;
  onReplace: (funnelPage: FunnelPage) => void;
  onDelete: (funnelPageId: string) => void;
}

type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'default';

function tileTone(pageType: string): string {
  if (pageType === 'LANDING') return 'bg-ds-okBg border-ds-okBorder';
  return 'bg-ds-surface2 border-ds-line';
}

function pageStatusTone(status: string | undefined): Tone {
  switch (status) {
    case 'PUBLISHED':
      return 'ok';
    case 'DRAFT':
      return 'warn';
    case 'ARCHIVED':
      return 'muted';
    default:
      return 'default';
  }
}

function formatStatus(status: string | undefined): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function classes(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export default function FunnelPageCard(props: FunnelPageCardProps) {
  const {
    funnelPage,
    funnelId,
    landingPages,
    canReorder,
    isDragging,
    isDragOver,
    validationError,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
    onReplace,
    onDelete,
  } = props;

  const [editingStepSlug, setEditingStepSlug] = useState(false);
  const [stepSlugValue, setStepSlugValue] = useState(funnelPage.stepSlug || '');
  const [stepSlugError, setStepSlugError] = useState<string | null>(null);
  const [isSavingStepSlug, setIsSavingStepSlug] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopySlug = useCallback(() => {
    const slug = `/n/${funnelId}/${funnelPage.stepSlug}`;
    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    navigator.clipboard
      .writeText(slug)
      .then(markCopied)
      .catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = slug;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        markCopied();
      });
  }, [funnelId, funnelPage.stepSlug]);

  const validateStepSlug = (value: string): boolean => {
    if (!value) {
      setStepSlugError('Slug is required');
      return false;
    }
    if (value.length > 20) {
      setStepSlugError('Max 20 characters');
      return false;
    }
    if (!/^[a-zA-Z]+$/.test(value)) {
      setStepSlugError('Letters only (a-z)');
      return false;
    }
    setStepSlugError(null);
    return true;
  };

  const handleStepSlugChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 20);
    setStepSlugValue(cleaned);
    if (cleaned) validateStepSlug(cleaned);
  };

  const handleSaveStepSlug = async () => {
    if (!validateStepSlug(stepSlugValue)) return;
    setIsSavingStepSlug(true);
    try {
      const response = await fetch(`/api/funnel/${funnelId}/page`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId: funnelPage.id, stepSlug: stepSlugValue }),
      });
      if (response.ok) {
        setEditingStepSlug(false);
        window.location.reload();
      } else {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setStepSlugError(error.error || 'Failed to save');
      }
    } catch (err) {
      console.error(err);
      setStepSlugError('Failed to save');
    } finally {
      setIsSavingStepSlug(false);
    }
  };

  const startEditStepSlug = () => {
    setEditingStepSlug(true);
    setStepSlugValue(funnelPage.stepSlug || '');
    setStepSlugError(null);
  };

  const page = funnelPage.page;
  // The referenced page was deleted: its real type/status are gone, so the step list defaulted it
  // to LANDING. Render it honestly as an orphan instead of a fake landing page.
  const isMissing = !page;
  const isLanding = funnelPage.pageType === 'LANDING' && !isMissing;
  const landingIndex = landingPages.findIndex((p) => p.id === funnelPage.id);
  const multipleLandings = isLanding && landingPages.length > 1;
  const stepLabel = multipleLandings ? ` (Step ${landingIndex + 1})` : '';
  const hasError = !!validationError;

  const typeLabel = isMissing ? 'Deleted page' : PAGE_TYPE_LABELS[funnelPage.pageType] || funnelPage.pageType;
  const TypeIcon = isMissing ? Unlink : PAGE_TYPE_ICON[funnelPage.pageType] || FileText;

  const slugPath = page
    ? page.slug.startsWith('/')
      ? page.slug
      : `/${page.slug}`
    : 'Page not found — referenced page was deleted';

  const rootClass = classes(
    'bg-ds-card border rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)] transition-colors',
    hasError ? 'border-ds-badBorder bg-ds-badBg' : 'border-ds-line',
    isDragOver && !hasError && 'border-ds-accent ring-2 ring-ds-accent/15',
    isDragging && 'opacity-50',
    canReorder && 'cursor-grab',
  );

  const stepSlugDisplay = `/n/${funnelId}/${funnelPage.stepSlug}`;

  return (
    <div
      draggable={canReorder}
      onDragStart={(e) => canReorder && onDragStart(e, funnelPage)}
      onDragOver={(e) => canReorder && onDragOver(e, funnelPage)}
      onDrop={(e) => canReorder && onDrop(e, funnelPage)}
      onDragEnd={onDragEnd}
      className={rootClass}
    >
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {canReorder && (
            <div className="text-ds-faint p-0.5 shrink-0" title="Drag to reorder">
              <GripVertical className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
          <div
            className={classes(
              'w-10 h-10 rounded-[8px] flex items-center justify-center text-[18px] relative shrink-0 border',
              isMissing ? 'bg-ds-warnBg border-ds-warnBorder' : tileTone(funnelPage.pageType),
            )}
          >
            <TypeIcon className="w-[18px] h-[18px]" aria-hidden="true" />
            {multipleLandings && (
              <span className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-ds-ok text-white text-[10px] font-semibold flex items-center justify-center border-2 border-ds-card">
                {landingIndex + 1}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ds-ink truncate">
              {typeLabel}
              {stepLabel}
            </div>
            <div className="text-[12px] text-ds-muted font-ds-mono tabular truncate mt-0.5">
              {slugPath}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isMissing ? (
            <DsBadge tone="bad">Deleted</DsBadge>
          ) : (
            <DsBadge tone={pageStatusTone(page?.status)}>{formatStatus(page?.status)}</DsBadge>
          )}
          {!isMissing && (
            <DsButton asChild size="sm" leftIcon={<SettingsIcon className="w-3.5 h-3.5" aria-hidden="true" />}>
              <a href={`/page/${funnelPage.pageId}`}>Edit page</a>
            </DsButton>
          )}
          <DsButton
            size="sm"
            title="Replace with another page"
            leftIcon={<Replace className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={() => onReplace(funnelPage)}
          >
            Replace
          </DsButton>
          <button
            type="button"
            title="Remove from funnel"
            onClick={() => onDelete(funnelPage.id)}
            className="inline-flex items-center justify-center gap-1.5 font-medium rounded-[7px] h-7 px-2.5 text-[12px] bg-ds-card border border-ds-badBorder text-ds-bad hover:bg-ds-badBg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>

      {hasError && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-[7px] bg-ds-badBg border border-ds-badBorder text-[12.5px] text-ds-badText">
          {validationError.error}
          {validationError.expectedUrl && (
            <div className="mt-1 font-ds-mono tabular text-[11.5px] opacity-80">
              Expected: {validationError.expectedUrl}
            </div>
          )}
        </div>
      )}

      {isMissing && !hasError && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-[7px] bg-ds-warnBg border border-ds-warnBorder text-[12.5px] text-ds-warnText">
          The page for this step was deleted. Replace it with another page or remove this step from the funnel.
        </div>
      )}

      {isLanding && (
        <div className="mx-5 mb-4 p-3 rounded-[8px] bg-ds-surface2 border border-ds-line">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11.5px] font-medium text-ds-muted">
              Redirect slug — letters only, max 20
            </label>
            {!editingStepSlug && (
              <button
                type="button"
                onClick={startEditStepSlug}
                className="text-[11px] font-medium text-ds-accent hover:underline"
              >
                {funnelPage.stepSlug ? 'Edit' : 'Set'}
              </button>
            )}
          </div>
          {editingStepSlug ? (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] text-ds-muted font-ds-mono tabular">
                  /n/{funnelId}/
                </span>
                <Input
                  type="text"
                  maxLength={20}
                  autoFocus
                  value={stepSlugValue}
                  onChange={(e) => handleStepSlugChange(e.target.value)}
                  className="h-auto px-2 py-1 text-[12px] font-ds-mono tabular"
                />
                <DsButton
                  variant="primary"
                  size="sm"
                  disabled={isSavingStepSlug || !stepSlugValue}
                  onClick={handleSaveStepSlug}
                  leftIcon={
                    isSavingStepSlug ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : undefined
                  }
                >
                  Save
                </DsButton>
                <DsButton size="sm" onClick={() => setEditingStepSlug(false)}>
                  Cancel
                </DsButton>
              </div>
              {stepSlugError && (
                <span className="block mt-1 text-[11.5px] text-ds-bad">{stepSlugError}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {funnelPage.stepSlug ? (
                <code className="inline-block px-2 py-1 rounded-[6px] text-[12px] font-ds-mono tabular border bg-ds-okBg border-ds-okBorder text-ds-okText">
                  {stepSlugDisplay}
                </code>
              ) : (
                <code className="inline-block px-2 py-1 rounded-[6px] text-[12px] font-ds-mono tabular border bg-ds-warnBg border-ds-warnBorder text-ds-warnText">
                  (Not set)
                </code>
              )}
              {funnelPage.stepSlug && (
                <button
                  type="button"
                  title="Copy slug"
                  onClick={handleCopySlug}
                  className="inline-flex items-center justify-center h-6 w-6 rounded-[6px] text-ds-muted hover:text-ds-ink hover:bg-ds-card border border-transparent hover:border-ds-line transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
