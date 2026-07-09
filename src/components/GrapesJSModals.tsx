import React, { useEffect, useState } from 'react';
import { MonacoField } from './grapesjs/MonacoField';
import { Input, dsFieldLabelClass } from '@/components/primitives';

export { registerImageTraits } from './grapesjs/traits/image-traits';

export const DEFAULT_HTML = `
<section style="padding:96px 24px;text-align:center;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#ffffff;">
  <h1 style="font-size:48px;font-weight:800;margin:0 0 16px;">Welcome to Your Page</h1>
  <p style="font-size:18px;max-width:640px;margin:0 auto 32px;opacity:0.9;">Start building something people love. Edit this section to tell your story.</p>
  <a href="#features" style="display:inline-block;padding:14px 32px;background:#ffffff;color:#4f46e5;font-weight:700;border-radius:8px;text-decoration:none;">Get Started</a>
</section>
<section id="features" style="padding:80px 24px;background:#ffffff;color:#111827;">
  <h2 style="font-size:36px;font-weight:700;text-align:center;margin:0 0 48px;">Features</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:960px;margin:0 auto;">
    <div style="padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h3 style="font-size:20px;font-weight:600;margin:0 0 8px;">Feature One</h3>
      <p style="margin:0;color:#6b7280;">Describe the first thing that makes your product great.</p>
    </div>
    <div style="padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h3 style="font-size:20px;font-weight:600;margin:0 0 8px;">Feature Two</h3>
      <p style="margin:0;color:#6b7280;">Describe the second thing that makes your product great.</p>
    </div>
    <div style="padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h3 style="font-size:20px;font-weight:600;margin:0 0 8px;">Feature Three</h3>
      <p style="margin:0;color:#6b7280;">Describe the third thing that makes your product great.</p>
    </div>
  </div>
</section>
`.trim();

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (url: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function ImportModal({ isOpen, onClose, onImport, isLoading, error }: ImportModalProps) {
  const [url, setUrl] = useState('');

  if (!isOpen) return null;

  const trimmed = url.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trimmed) onImport(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">Import from URL</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <label htmlFor="import-url" className={dsFieldLabelClass}>
              Website URL
            </label>
            <Input
              id="import-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              placeholder="https://example.com/page"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              The HTML will be downloaded and all images/assets will be uploaded to your storage.
            </p>
          </div>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !trimmed}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isLoading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {isLoading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type SourceTab = 'html' | 'css' | 'head' | 'scripts';

interface SourceEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  html: string;
  css: string;
  headContent: string;
  bodyScripts: string;
  onApply: (html: string, css: string, headContent: string, bodyScripts: string) => void;
}

export function SourceEditorModal({
  isOpen,
  onClose,
  html,
  css,
  headContent,
  bodyScripts,
  onApply,
}: SourceEditorModalProps) {
  const [editedHtml, setEditedHtml] = useState(html);
  const [editedCss, setEditedCss] = useState(css);
  const [editedHead, setEditedHead] = useState(headContent);
  const [editedScripts, setEditedScripts] = useState(bodyScripts);
  const [activeTab, setActiveTab] = useState<SourceTab>('html');

  useEffect(() => {
    setEditedHtml(html);
    setEditedCss(css);
    setEditedHead(headContent);
    setEditedScripts(bodyScripts);
  }, [html, css, headContent, bodyScripts, isOpen]);

  if (!isOpen) return null;

  function handleApply() {
    onApply(editedHtml, editedCss, editedHead, editedScripts);
    onClose();
  }

  const tabs: { id: SourceTab; label: string }[] = [
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'head', label: 'Head' },
    { id: 'scripts', label: 'Scripts' },
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">Edit Source</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-5 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {activeTab === 'html' && (
            <MonacoField language="html" value={editedHtml} onChange={setEditedHtml} height="60vh" />
          )}
          {activeTab === 'css' && (
            <MonacoField language="css" value={editedCss} onChange={setEditedCss} height="60vh" />
          )}
          {activeTab === 'head' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Add custom content to the &lt;head&gt; section, such as meta tags or external stylesheets.
              </p>
              <MonacoField language="html" value={editedHead} onChange={setEditedHead} height="60vh" />
            </div>
          )}
          {activeTab === 'scripts' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Add &lt;script&gt; tags to be included at the end of the &lt;body&gt;. These are preserved across saves.
              </p>
              <MonacoField language="html" value={editedScripts} onChange={setEditedScripts} height="60vh" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
