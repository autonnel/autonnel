import React, { useState, useEffect } from 'react';
import AlertBox from '../primitives/AlertBox';
import CreatePageModal from '../page-create/CreatePageModal';
import { Button as DsButton, Card as DsCard } from '../primitives/ds';
import {
  FunnelPageCard,
  AddPageModal,
  ReplacePageModal,
  PAGE_TYPE_ORDER,
  REQUIRED_FUNNEL_PAGES,
} from './index';
import type { Funnel, FunnelPage, Page, FunnelValidationError } from './types';

export interface FunnelStepsProps {
  funnel: Funnel;
  allPages: Page[];
  validationErrors?: FunnelValidationError[];
  boundPageIds?: Record<string, string>;
}

type CreatePageMode = 'add' | 'replace';

const PLUS_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EMPTY_ICON = (
  <svg className="w-6 h-6 text-ds-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 6h18M3 12h18M3 18h12" strokeLinecap="round" />
  </svg>
);

function FunnelStepsContent({
  funnel,
  allPages,
  validationErrors = [],
  boundPageIds = {},
}: FunnelStepsProps) {
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreatePageModal, setShowCreatePageModal] = useState(false);
  const [createPageMode, setCreatePageMode] = useState<CreatePageMode>('add');
  const [selectedFunnelPage, setSelectedFunnelPage] = useState<FunnelPage | null>(null);
  const [selectedPageType, setSelectedPageType] = useState<string>('');
  const [draggedItem, setDraggedItem] = useState<FunnelPage | null>(null);
  const [dragOverItem, setDragOverItem] = useState<FunnelPage | null>(null);

  const getSortedPages = () =>
    [...funnel.pages].sort((a, b) => {
      const orderA = PAGE_TYPE_ORDER[a.pageType] ?? 99;
      const orderB = PAGE_TYPE_ORDER[b.pageType] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.subOrder - b.subOrder;
    });

  const getLandingPages = () =>
    funnel.pages.filter((p) => p.pageType === 'LANDING').sort((a, b) => a.subOrder - b.subOrder);

  const getMissingRequiredPages = () => {
    const present = funnel.pages.map((p) => p.pageType);
    return REQUIRED_FUNNEL_PAGES.filter((t) => !present.includes(t));
  };

  const getValidationError = (funnelPageId: string) =>
    validationErrors.find((e) => e.funnelPageId === funnelPageId);

  const handleDeletePage = async (funnelPageId: string) => {
    if (!confirm('Are you sure you want to remove this page from the funnel?')) return;
    try {
      const response = await fetch(`/api/funnel/${funnel.id}/page`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId }),
      });
      if (response.ok) {
        window.location.reload();
      } else {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        alert(error.error || 'Failed to delete page');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete page');
    }
  };

  const handleDragStart = (e: React.DragEvent, fp: FunnelPage) => {
    setDraggedItem(fp);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, fp: FunnelPage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem && draggedItem.id !== fp.id && draggedItem.pageType === fp.pageType) {
      setDragOverItem(fp);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, target: FunnelPage) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === target.id || draggedItem.pageType !== target.pageType) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }
    try {
      const response = await fetch(`/api/funnel/${funnel.id}/page/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceFunnelPageId: draggedItem.id, targetFunnelPageId: target.id }),
      });
      if (response.ok) {
        window.location.reload();
      } else {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        alert(error.error || 'Failed to reorder pages');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to reorder pages');
    } finally {
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const openReplaceModal = (fp: FunnelPage) => {
    setSelectedFunnelPage(fp);
    setShowReplaceModal(true);
  };

  const openAddModal = () => {
    setShowAddModal(true);
  };

  const handleCreatePageFromReplace = () => {
    setCreatePageMode('replace');
    setShowReplaceModal(false);
    setShowCreatePageModal(true);
  };

  const handleCreatePageFromAdd = (pageType: string) => {
    setSelectedPageType(pageType);
    setCreatePageMode('add');
    setShowAddModal(false);
    setShowCreatePageModal(true);
  };

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setShowReplaceModal(false);
        setShowAddModal(false);
        setShowCreatePageModal(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const handleCreatedPage = async (page: { id: string; slug: string }) => {
    setShowCreatePageModal(false);
    try {
      if (createPageMode === 'replace' && selectedFunnelPage) {
        const r = await fetch(`/api/funnel/${funnel.id}/page`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funnelPageId: selectedFunnelPage.id, pageId: page.id }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => ({}))) as { error?: string };
          alert(e.error || 'Failed to replace page');
        }
      } else if (createPageMode === 'add') {
        const r = await fetch(`/api/funnel/${funnel.id}/page`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepSlug: page.slug, pageId: page.id }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => ({}))) as { error?: string };
          alert(e.error || 'Failed to add page to funnel');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      window.location.reload();
    }
  };

  const missingRequiredPages = getMissingRequiredPages();
  const isFunnelComplete = missingRequiredPages.length === 0;
  const landingPages = getLandingPages();
  const upsellCount = funnel.pages.filter((p) => p.pageType === 'UPSELL').length;

  return (
    <div>
      {!isFunnelComplete && (
        <AlertBox type="warning" className="mb-6">
          Complete the funnel setup (checkout, thankyou, error pages) to enable the checkout flow
        </AlertBox>
      )}

      <div className="flex justify-between items-center mb-5">
        <div>
          <div className="text-[14px] font-semibold text-ds-ink">Funnel pages</div>
          <div className="text-[12.5px] text-ds-muted mt-0.5">
            Drag to reorder pages within the same step type.
          </div>
        </div>
        <DsButton variant="primary" size="md" leftIcon={PLUS_ICON} onClick={openAddModal}>
          Bind step
        </DsButton>
      </div>

      {funnel.pages.length === 0 ? (
        <DsCard padded={false}>
          <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-ds-surface2 border border-ds-line flex items-center justify-center">
              {EMPTY_ICON}
            </div>
            <div className="text-[14px] font-semibold text-ds-ink">No pages configured</div>
            <div className="text-[12.5px] text-ds-muted max-w-[320px]">
              Bind your first step to start building this funnel.
            </div>
            <div className="mt-2">
              <DsButton variant="primary" onClick={openAddModal}>
                Add first page
              </DsButton>
            </div>
          </div>
        </DsCard>
      ) : (
        <div className="flex flex-col gap-4">
          {getSortedPages().map((fp) => (
            <FunnelPageCard
              key={fp.id}
              funnelPage={fp}
              funnelId={funnel.id}
              landingPages={landingPages}
              canReorder={
                (fp.pageType === 'LANDING' && landingPages.length > 1) ||
                (fp.pageType === 'UPSELL' && upsellCount > 1)
              }
              isDragging={draggedItem?.id === fp.id}
              isDragOver={dragOverItem?.id === fp.id}
              validationError={getValidationError(fp.id)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onReplace={openReplaceModal}
              onDelete={handleDeletePage}
            />
          ))}
        </div>
      )}

      {showReplaceModal && selectedFunnelPage && (
        <ReplacePageModal
          funnelId={funnel.id}
          funnelPage={selectedFunnelPage}
          allPages={allPages}
          boundPageIds={boundPageIds}
          onClose={() => setShowReplaceModal(false)}
          onCreatePage={handleCreatePageFromReplace}
        />
      )}

      {showAddModal && (
        <AddPageModal
          funnelId={funnel.id}
          existingPages={funnel.pages}
          allPages={allPages}
          boundPageIds={boundPageIds}
          onClose={() => setShowAddModal(false)}
          onCreatePage={handleCreatePageFromAdd}
        />
      )}

      {showCreatePageModal && (
        <CreatePageModal
          onClose={() => setShowCreatePageModal(false)}
          onCreated={handleCreatedPage}
          redirectAfterCreate={false}
        />
      )}
    </div>
  );
}

export default function FunnelSteps(props: FunnelStepsProps) {
  return <FunnelStepsContent {...props} />;
}
