import * as React from 'react';
import { Drawer, Button } from '@/components/primitives/ds';

interface UploadedImage {
  url: string;
  key: string;
  fileName: string;
}

export interface FolderUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded?: (images: UploadedImage[]) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

const FolderUploadModal: React.FC<FolderUploadModalProps> = ({ open, onClose, onUploaded }) => {
  const [files, setFiles] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setFiles([]);
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const images = await Promise.all(
        files.map(async (file) => ({ base64: await fileToBase64(file), fileName: file.name })),
      );
      const res = await fetch('/api/page/ai-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      const data = (await res.json()) as { images: UploadedImage[] };
      onUploaded?.(data.images ?? []);
      reset();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Upload images"
      subtitle="Select up to 10 images to upload"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || files.length === 0}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="p-5 space-y-3">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
          className="block w-full text-[13px] text-ds-ink file:mr-3 file:rounded-md file:border-0 file:bg-ds-surface2 file:px-3 file:py-1.5 file:text-[13px] file:text-ds-ink"
        />
        {files.length > 0 && (
          <ul className="text-[13px] text-ds-muted space-y-1">
            {files.map((f) => (
              <li key={f.name} className="truncate">
                {f.name}
              </li>
            ))}
          </ul>
        )}
        {error && <div className="text-[13px] text-ds-danger">{error}</div>}
      </div>
    </Drawer>
  );
};

export default FolderUploadModal;
