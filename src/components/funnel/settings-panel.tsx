import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import FormInput from '../primitives/FormInput';
import AlertBox from '../primitives/AlertBox';
import { Modal, Button, Input, Textarea } from '../primitives';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { apiCall, ApiCallError } from '@/lib/api/client';

interface Funnel {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FunnelSettingsProps {
  funnel: Funnel;
}

export default function FunnelSettings({ funnel }: FunnelSettingsProps) {
  const [name, setName] = useState(funnel.name);
  const [description, setDescription] = useState(funnel.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Funnel name is required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await apiCall('PUT /api/funnel/:funnelId', { name: name.trim(), description: description.trim() }, { params: { funnelId: funnel.id } });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(err instanceof ApiCallError ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const openDelete = () => {
    setDeleteConfirmText('');
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    if (isDeleting) return;
    setDeleteOpen(false);
    setDeleteConfirmText('');
    setDeleteError(null);
  };

  const canConfirmDelete = deleteConfirmText === funnel.name && !isDeleting;

  const handleDelete = async () => {
    if (!canConfirmDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiCall('DELETE /api/funnel/:funnelId', null, { params: { funnelId: funnel.id } });
      window.location.href = '/funnels';
    } catch (err) {
      console.error(err);
      setDeleteError(err instanceof ApiCallError ? err.message : 'Failed to delete funnel');
      setIsDeleting(false);
    }
  };

  const hasChanges = name !== funnel.name || description !== (funnel.description || '');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[14px] font-semibold text-ds-ink">Funnel settings</div>
        <div className="text-[12.5px] text-ds-muted mt-0.5">
          Manage this funnel's basic information.
        </div>
      </div>

      {error && <AlertBox type="error">{error}</AlertBox>}
      {success && <AlertBox type="success">Settings saved successfully.</AlertBox>}

      <DsCard title="Basic information">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-medium text-ds-ink mb-1.5">Funnel name</label>
            <FormInput
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter funnel name"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-ds-ink mb-1.5">Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description for this funnel"
              className="w-full resize-none h-24"
            />
          </div>
          <div className="flex justify-end">
            <DsButton variant="primary" onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </DsButton>
          </div>
        </div>
      </DsCard>

      <DsCard title="Funnel information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-ds-faint font-medium">Funnel ID</div>
            <code className="text-[12.5px] bg-ds-surface2 border border-ds-line px-2 py-1 rounded font-ds-mono tabular text-ds-slate inline-block mt-1">
              {funnel.id}
            </code>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-ds-faint font-medium">Created</div>
            <div className="text-[13px] text-ds-ink mt-1 font-ds-mono tabular">
              {new Date(funnel.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-ds-faint font-medium">Last updated</div>
            <div className="text-[13px] text-ds-ink mt-1 font-ds-mono tabular">
              {new Date(funnel.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </DsCard>

      <DsCard
        title={
          <span className="flex items-center gap-2">
            Danger zone <DsBadge tone="bad">Destructive</DsBadge>
          </span>
        }
        subtitle="Delete this funnel. All page bindings, ad bindings and experiment variants will be removed."
      >
        <div className="flex">
          <button
            type="button"
            onClick={openDelete}
            disabled={isDeleting}
            className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] gap-2 bg-ds-card border border-ds-badBorder text-ds-bad hover:bg-[#FEF2F2] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete funnel
          </button>
        </div>
      </DsCard>

      {deleteOpen && (
        <Modal isOpen={deleteOpen} onClose={closeDelete} title="Delete funnel" maxWidth="md">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{funnel.name}</span> along with
              all page bindings, ad bindings and experiment variants. This action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              To confirm, type the funnel name exactly:
            </p>
            <div className="bg-muted/40 border border-border rounded-md px-3 py-2 text-sm font-mono break-all">
              {funnel.name}
            </div>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type funnel name to confirm"
              disabled={isDeleting}
              autoFocus
              className="w-full"
            />
            {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDelete}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canConfirmDelete}
                className="inline-flex items-center justify-center font-medium rounded-md h-9 px-4 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting…' : 'Delete funnel'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
