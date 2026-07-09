import { useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import Modal from '../primitives/Modal';
import { Button as DsButton } from '../primitives/ds';
import FormSelect from '../primitives/FormSelect';
import { SearchableSelect } from '../primitives/SearchableSelect';
import {
  FUNNEL_TO_DB_PAGE_TYPE,
  MULTI_PAGE_TYPES,
  PAGE_TYPE_LABELS,
  UNIQUE_PAGE_TYPES,
} from './types';
import type { FunnelPage, Page } from './types';

interface AddPageModalProps {
  funnelId: string;
  existingPages: FunnelPage[];
  allPages: Page[];
  boundPageIds?: Record<string, string>;
  onClose: () => void;
  onCreatePage: (pageType: string) => void;
}

export default function AddPageModal({
  funnelId,
  existingPages,
  allPages,
  boundPageIds = {},
  onClose,
  onCreatePage,
}: AddPageModalProps) {
  const [selectedPageType, setSelectedPageType] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getAvailablePageTypes() {
    const existingTypes = existingPages.map((p) => p.pageType);
    return [
      ...MULTI_PAGE_TYPES,
      ...UNIQUE_PAGE_TYPES.filter((t) => !existingTypes.includes(t)),
    ];
  }

  const filteredPages = useMemo(() => {
    if (!selectedPageType) return [];
    return allPages.filter(
      (p) =>
        p.type === FUNNEL_TO_DB_PAGE_TYPE[selectedPageType] &&
        !(selectedPageType === 'LANDING' && boundPageIds[p.id]),
    );
  }, [selectedPageType, allPages, boundPageIds]);

  const dbPageType = FUNNEL_TO_DB_PAGE_TYPE[selectedPageType]?.toLowerCase() || '';

  const pageOptions = useMemo(
    () =>
      filteredPages.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.slug})`,
        description: p.status,
      })),
    [filteredPages],
  );

  async function handleAddPage() {
    if (!selectedPageId || !selectedPageType) return;
    const stepSlug = allPages.find((p) => p.id === selectedPageId)?.slug;
    if (!stepSlug) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/funnel/${funnelId}/page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepSlug, pageId: selectedPageId }),
      });
      if (response.ok) {
        window.location.reload();
      } else {
        const error = (await response.json()) as { error?: string };
        alert(error.error || 'Failed to add page');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to add page');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Page to Funnel"
      description="Select a page type and page to add to the funnel"
      maxWidth="md"
    >
      <FormSelect
        label="Step Type"
        value={selectedPageType}
        onChange={(e) => {
          setSelectedPageType(e.target.value);
          setSelectedPageId('');
        }}
      >
        <option value="">Select page type</option>
        {getAvailablePageTypes().map((type) => (
          <option key={type} value={type}>
            {PAGE_TYPE_LABELS[type]}
          </option>
        ))}
      </FormSelect>

      <SearchableSelect
        label={`Page ${selectedPageType ? `(only ${dbPageType} type pages)` : ''}`}
        placeholder="Select a page"
        value={selectedPageId}
        options={pageOptions}
        onChange={setSelectedPageId}
        disabled={!selectedPageType}
        error={
          selectedPageType && filteredPages.length === 0
            ? `No ${dbPageType} pages found. Create one below.`
            : undefined
        }
      />

      {selectedPageType ? (
        <div className="mb-6 mt-3">
          <DsButton
            size="sm"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => onCreatePage(selectedPageType)}
          >
            Create new {dbPageType} page
          </DsButton>
        </div>
      ) : null}

      <div className="flex gap-2 justify-end">
        <DsButton onClick={onClose}>Cancel</DsButton>
        <DsButton
          variant="primary"
          onClick={handleAddPage}
          disabled={!selectedPageType || !selectedPageId || isSubmitting}
          leftIcon={isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
        >
          Add page
        </DsButton>
      </div>
    </Modal>
  );
}
