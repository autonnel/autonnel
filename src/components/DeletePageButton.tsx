import * as React from 'react';
import { Modal, Button, Input } from './primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';

interface DeletePageButtonProps {
  pageId: string;
  pageName: string;
}

export default function DeletePageButton({ pageId, pageName }: DeletePageButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClose = () => {
    if (deleting) return;
    setOpen(false);
    setConfirmText('');
    setError(null);
  };

  const canSubmit = confirmText === pageName && !deleting;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setDeleting(true);
    setError(null);
    try {
      await apiCall('DELETE /api/page/:pageId', null, { params: { pageId } });
      window.location.reload();
    } catch (e) {
      setError(e instanceof ApiCallError ? e.message : 'Failed to delete page');
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center font-medium rounded-[6px] h-7 px-2.5 text-[12px] bg-ds-card border border-ds-line text-red-600 hover:bg-red-50 hover:border-red-300"
      >
        Delete
      </button>
      {open && (
        <Modal isOpen={open} onClose={handleClose} title="Delete page" maxWidth="md">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{pageName}</span>.
              This action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              To confirm, type the page name exactly:
            </p>
            <div className="bg-muted/40 border border-border rounded-md px-3 py-2 text-sm font-mono break-all">
              {pageName}
            </div>
            <Input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type page name to confirm"
              disabled={deleting}
              autoFocus
              className="w-full"
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={deleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canSubmit}
                className="inline-flex items-center justify-center font-medium rounded-md h-9 px-4 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting…' : 'Delete page'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
