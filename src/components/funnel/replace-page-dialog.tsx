import { useState, useMemo } from 'react';
import { Loader2, Plus } from 'lucide-react';
import Modal from '../primitives/Modal';
import { Button as DsButton } from '../primitives/ds';
import { SearchableSelect } from '../primitives/SearchableSelect';
import { FUNNEL_TO_DB_PAGE_TYPE, PAGE_TYPE_LABELS } from './types';
import type { FunnelPage, Page } from './types';

export interface ReplacePageModalProps {
  funnelId: string;
  funnelPage: FunnelPage;
  allPages: Page[];
  boundPageIds?: Record<string, string>;
  onClose: () => void;
  onCreatePage: () => void;
}

export default function ReplacePageModal({
  funnelId,
  funnelPage,
  allPages,
  boundPageIds = {},
  onClose,
  onCreatePage,
}: ReplacePageModalProps) {
  const [selectedPageId, setSelectedPageId] = useState<string>(funnelPage.pageId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredPages = useMemo(
    () =>
      allPages.filter(
        (p) =>
          p.type === FUNNEL_TO_DB_PAGE_TYPE[funnelPage.pageType] &&
          !(
            funnelPage.pageType === 'LANDING' &&
            boundPageIds[p.id] &&
            p.id !== funnelPage.pageId
          )
      ),
    [allPages, funnelPage.pageType, funnelPage.pageId, boundPageIds]
  );

  const dbPageType = useMemo(
    () => FUNNEL_TO_DB_PAGE_TYPE[funnelPage.pageType]?.toLowerCase(),
    [funnelPage.pageType]
  );

  const pageOptions = useMemo(
    () =>
      filteredPages.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.slug})`,
        description: p.status,
      })),
    [filteredPages]
  );

  const handleReplacePage = async () => {
    if (!selectedPageId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/funnel/${funnelId}/page`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId: funnelPage.id, pageId: selectedPageId }),
      });
      if (response.ok) {
        window.location.reload();
      } else {
        const error = (await response.json()) as { error?: string };
        alert(error.error || 'Failed to replace page');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to replace page');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Replace ${PAGE_TYPE_LABELS[funnelPage.pageType]}`}
      description="Select a different page to use for this step in the funnel"
      maxWidth="md"
    >
      <SearchableSelect
        label={`Page (only ${dbPageType} type pages)`}
        placeholder="Select a page"
        value={selectedPageId}
        options={pageOptions}
        onChange={setSelectedPageId}
        error={
          filteredPages.length === 0
            ? `No ${dbPageType} pages found. Create one below.`
            : undefined
        }
      />

      <div className="mb-6 mt-3">
        <DsButton
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => onCreatePage()}
        >
          Create new {dbPageType} page
        </DsButton>
      </div>

      <div className="flex gap-2 justify-end">
        <DsButton onClick={onClose}>Cancel</DsButton>
        <DsButton
          variant="primary"
          onClick={handleReplacePage}
          disabled={!selectedPageId || isSubmitting}
          leftIcon={isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
        >
          Replace page
        </DsButton>
      </div>
    </Modal>
  );
}
