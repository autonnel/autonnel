import React, { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, AlertBox, Modal } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { DomainDto } from '@/contracts/site-config';

type Domain = DomainDto;

interface DomainsPanelProps {
  initialDomains: Domain[];
}

export default function DomainsPanel({ initialDomains }: DomainsPanelProps) {
  const [domains, setDomains] = useState<Domain[]>(initialDomains);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    try {
      setDomains(await apiCall('GET /api/settings/domains', null));
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to load');
    }
  };

  const handleAdd = async () => {
    if (!newDomain) return;
    setAdding(true);
    setError(null);
    try {
      await apiCall('POST /api/settings/domains', {
        domain: newDomain.trim().toLowerCase(),
        isPrimary: domains.length === 0,
      });
      setShowAdd(false);
      setNewDomain('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await apiCall('PUT /api/settings/domains/:id', { isPrimary: true }, { params: { id } });
      await refresh();
    } catch (err) {
      alert('Failed to set primary');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this domain?')) return;
    try {
      await apiCall('DELETE /api/settings/domains/:id', null, { params: { id } });
      await refresh();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[12.5px] text-ds-muted">Bound domains pointing to this storefront.</div>
        <DsButton variant="primary" onClick={() => setShowAdd(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>Add domain</DsButton>
      </div>
      {error && <AlertBox type="error">{error}</AlertBox>}

      <DsCard padded={false}>
        {domains.length === 0 ? (
          <div className="px-6 py-16 text-center text-[13px] text-ds-muted">No domains bound yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-ds-surface2 border-b border-ds-line">
                <tr>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Host</th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Status</th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map(d => (
                  <tr key={d.id} className="hover:bg-ds-surface2 transition-colors">
                    <td className="px-4 py-3 text-[13.5px] text-ds-ink border-b border-[#F3F4F6] font-ds-mono tabular">{d.domain}</td>
                    <td className="px-4 py-3 border-b border-[#F3F4F6]">
                      {d.isPrimary ? <DsBadge tone="ok">Primary</DsBadge> : <DsBadge tone="muted">Secondary</DsBadge>}
                    </td>
                    <td className="px-4 py-3 border-b border-[#F3F4F6] text-right">
                      <div className="inline-flex gap-2">
                        {!d.isPrimary && (
                          <DsButton variant="default" size="sm" onClick={() => handleSetPrimary(d.id)}>Set primary</DsButton>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="inline-flex items-center justify-center rounded-[7px] h-7 w-7 bg-ds-card border border-ds-badBorder text-ds-bad hover:bg-[#FEF2F2]"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DsCard>

      {showAdd && (
        <Modal isOpen={true} onClose={() => setShowAdd(false)} title="Add domain" maxWidth="md">
          <FormInput label="Domain" value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="example.com" />
          <div className="flex gap-3 mt-6">
            <DsButton variant="default" onClick={() => setShowAdd(false)} className="flex-1">Cancel</DsButton>
            <DsButton variant="primary" onClick={handleAdd} disabled={!newDomain || adding} className="flex-1">
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </DsButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
