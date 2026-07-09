import * as React from 'react';
import { Drawer, Button } from '@/components/primitives/ds';
import { apiCall } from '@/lib/api/client';

interface PageAsset {
  src: string;
  size: number;
  key: string;
}

export interface FileManagerModalProps {
  open: boolean;
  pageId: string;
  onClose: () => void;
  onSelect?: (asset: PageAsset) => void;
}

const FileManagerModal: React.FC<FileManagerModalProps> = ({ open, pageId, onClose, onSelect }) => {
  const [assets, setAssets] = React.useState<PageAsset[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiCall('GET /api/page/:pageId/assets', null, { params: { pageId } })
      .then((data) => {
        if (!cancelled) setAssets(data.assets ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load assets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="File manager"
      subtitle="Browse assets uploaded to this page"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="p-5">
        {loading && <div className="text-[13px] text-ds-muted">Loading assets…</div>}
        {error && <div className="text-[13px] text-ds-danger">{error}</div>}
        {!loading && !error && assets.length === 0 && (
          <div className="text-[13px] text-ds-muted">No assets yet.</div>
        )}
        {!loading && !error && assets.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {assets.map((asset) => (
              <button
                key={asset.key}
                type="button"
                onClick={() => onSelect?.(asset)}
                className="group aspect-square rounded-md border border-ds-line overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
                title={asset.key}
              >
                <img
                  src={asset.src}
                  alt={asset.key}
                  className="w-full h-full object-cover group-hover:opacity-90"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default FileManagerModal;
