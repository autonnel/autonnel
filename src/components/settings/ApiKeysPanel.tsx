import { useState } from 'react';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { ApiKeyDto } from '@/contracts/identity';
import { Input, Switch } from '@/components/primitives';
import { cn } from '@/lib/utils';

interface ApiKeysPanelProps {
  initialKeys: ApiKeyDto[];
}

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export default function ApiKeysPanel({ initialKeys }: ApiKeysPanelProps) {
  const [keys, setKeys] = useState<ApiKeyDto[]>(initialKeys);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const data = await apiCall('GET /api/api-keys', null);
      setKeys(data.apiKeys);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to load API keys');
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const data = await apiCall('POST /api/api-keys', { name: newName.trim() || 'Default' });
      setRevealedKey(data.key);
      setShowCreate(false);
      setNewName('');
      await refresh();
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this API key? Any client using it will lose access.')) return;
    try {
      await apiCall('DELETE /api/api-keys', null, { query: { id } });
      await refresh();
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to delete');
    }
  }

  async function handleToggleWrite(id: string, current: boolean) {
    try {
      await apiCall('PATCH /api/api-keys', { id, writeAccess: !current });
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, writeAccess: !current } : k)));
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to update');
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      {revealedKey && (
        <div className="mb-4 p-4 rounded-[8px] bg-ds-okBg border border-ds-okBorder">
          <div className="text-[13px] font-semibold text-ds-okText mb-2">
            Key created. Copy it now — it won't be shown again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-ds-card border border-ds-line rounded text-[12.5px] font-ds-mono tabular text-ds-ink break-all">
              {revealedKey}
            </code>
            <button
              type="button"
              onClick={() => copyKey(revealedKey)}
              className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink text-ds-card hover:bg-[#1F2937]"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => setRevealedKey(null)}
              className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] text-ds-muted">
          {keys.length} key{keys.length === 1 ? '' : 's'}
        </div>
        {showCreate ? (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Key name (e.g. CI bot)"
              className={cn("w-[200px] h-8")}
            />
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              disabled={creating}
              className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink text-ds-card hover:bg-[#1F2937]"
          >
            + New key
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-[7px] bg-ds-badBg border border-ds-badBorder text-[12.5px] text-ds-badText">
          {error}
        </div>
      )}

      {keys.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-ds-muted bg-ds-surface2 border border-dashed border-ds-line rounded-[8px]">
          No API keys yet. Create one to access the public API.
        </div>
      ) : (
        <div className="overflow-x-auto border border-ds-line rounded-[8px]">
          <table className="w-full border-collapse">
            <thead className="bg-ds-surface2 border-b border-ds-line">
              <tr>
                <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Name</th>
                <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Key</th>
                <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Write</th>
                <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right">Created</th>
                <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-ds-surface2 transition-colors">
                  <td className="px-4 py-3 text-[13.5px] text-ds-ink border-b border-[#F3F4F6]">{k.name}</td>
                  <td className="px-4 py-3 text-[12.5px] text-ds-slate border-b border-[#F3F4F6] font-ds-mono tabular">
                    {k.key.includes('…') ? k.key : maskKey(k.key)}
                  </td>
                  <td className="px-4 py-3 border-b border-[#F3F4F6]">
                    <Switch
                      checked={k.writeAccess}
                      onCheckedChange={() => handleToggleWrite(k.id, k.writeAccess)}
                      aria-label={`Write access for ${k.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-ds-muted border-b border-[#F3F4F6] text-right font-ds-mono tabular">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 border-b border-[#F3F4F6] text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(k.id)}
                      className="inline-flex items-center justify-center font-medium rounded-[6px] h-7 px-2.5 text-[12px] bg-ds-card border border-ds-line text-ds-bad hover:bg-ds-badBg hover:border-ds-badBorder"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 px-4 py-3 bg-ds-surface2 border border-ds-line rounded-[8px]">
        <div className="text-[13px] font-semibold text-ds-ink mb-2">Usage</div>
        <p className="text-[12.5px] text-ds-muted mb-2">
          Send your key in the <code className="px-1 py-0.5 bg-ds-card border border-ds-line rounded text-[11px] font-ds-mono">Authorization</code> header:
        </p>
        <pre className="px-3 py-2 bg-ds-console text-[#D1D5DB] rounded text-[12px] font-ds-mono overflow-x-auto">
{`Authorization: Bearer your_api_key_here`}
        </pre>
      </div>
    </div>
  );
}
