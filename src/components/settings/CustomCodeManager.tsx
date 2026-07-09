import React, { useState } from 'react';
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';
import { Modal, FormInput, FormSelect, FormTextarea, AlertBox, Checkbox } from '../primitives';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { ScriptDto } from '@/contracts/site-config';

type Script = ScriptDto;

interface CustomCodeManagerProps {
  initialScripts: Script[];
}

const POSITION_OPTIONS: Array<{ value: 'HEAD' | 'BODY_START' | 'BODY_END'; label: string }> = [
  { value: 'HEAD', label: 'Inside <head>' },
  { value: 'BODY_START', label: 'After <body> opening' },
  { value: 'BODY_END', label: 'Before </body> closing' },
];

function getPositionLabel(position: string) {
  switch (position) {
    case 'HEAD': return '<head>';
    case 'BODY_START': return '<body> start';
    case 'BODY_END': return '<body> end';
    default: return position;
  }
}

export default function CustomCodeManager({ initialScripts }: CustomCodeManagerProps) {
  const [scripts, setScripts] = useState<Script[]>(initialScripts);
  const [error, setError] = useState<string | null>(null);
  const [showAddScript, setShowAddScript] = useState(false);
  const [newScript, setNewScript] = useState({
    name: '',
    position: 'HEAD' as 'HEAD' | 'BODY_START' | 'BODY_END',
    content: '',
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [editScript, setEditScript] = useState({
    name: '',
    position: 'HEAD' as 'HEAD' | 'BODY_START' | 'BODY_END',
    content: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleAddScript = async () => {
    if (!newScript.name || !newScript.content) return;
    setIsAdding(true);
    try {
      const script = await apiCall('POST /api/settings/custom-code', {
        name: newScript.name,
        position: newScript.position,
        content: newScript.content,
        enabled: true,
        order: scripts.length,
      });
      setScripts([...scripts, script]);
      setShowAddScript(false);
      setNewScript({ name: '', position: 'HEAD', content: '' });
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to add script');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm('Are you sure you want to delete this script?')) return;
    try {
      await apiCall('DELETE /api/settings/custom-code/:id', null, { params: { id: scriptId } });
      setScripts(scripts.filter(s => s.id !== scriptId));
    } catch (err) {
      alert('Failed to delete script');
    }
  };

  const handleToggleScript = async (scriptId: string, enabled: boolean) => {
    try {
      await apiCall('PUT /api/settings/custom-code/:id', { enabled }, { params: { id: scriptId } });
      setScripts(scripts.map(s => (s.id === scriptId ? { ...s, enabled } : s)));
    } catch (err) {
    }
  };

  const openEditModal = (script: Script) => {
    setEditingScript(script);
    setEditScript({
      name: script.name,
      position: script.position as 'HEAD' | 'BODY_START' | 'BODY_END',
      content: script.content,
    });
  };

  const closeEditModal = () => {
    setEditingScript(null);
    setEditScript({ name: '', position: 'HEAD', content: '' });
  };

  const handleEditScript = async () => {
    if (!editingScript || !editScript.name || !editScript.content) return;
    setIsEditing(true);
    try {
      const updatedScript = await apiCall(
        'PUT /api/settings/custom-code/:id',
        { name: editScript.name, position: editScript.position, content: editScript.content },
        { params: { id: editingScript.id } },
      );
      setScripts(scripts.map(s => (s.id === editingScript.id ? updatedScript : s)));
      closeEditModal();
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to update script');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="text-[12.5px] text-ds-muted">
          Custom code injected into every page (analytics, tracking, custom HTML/JS).
        </div>
        <DsButton variant="primary" onClick={() => setShowAddScript(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Add script
        </DsButton>
      </div>

      {error && <AlertBox type="error">{error}</AlertBox>}

      {scripts.length === 0 ? (
        <DsCard padded={false}>
          <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
            <div className="text-[14px] font-semibold text-ds-ink">No custom code</div>
            <div className="text-[12.5px] text-ds-muted max-w-[320px]">
              Add tracking scripts, analytics or custom code that runs on every page.
            </div>
            <div className="mt-2">
              <DsButton variant="primary" onClick={() => setShowAddScript(true)}>Add your first script</DsButton>
            </div>
          </div>
        </DsCard>
      ) : (
        <DsCard padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-ds-surface2 border-b border-ds-line">
                <tr>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left w-[40px]"></th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Name</th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Position</th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Snippet</th>
                  <th className="px-4 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scripts.map(script => (
                  <tr key={script.id} className={`hover:bg-ds-surface2 transition-colors ${script.enabled ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3 border-b border-[#F3F4F6]">
                      <Checkbox
                        checked={script.enabled}
                        onChange={e => handleToggleScript(script.id, e.target.checked)}
                        aria-label={`Toggle ${script.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-[13.5px] text-ds-ink border-b border-[#F3F4F6]">
                      <div className="font-medium">{script.name}</div>
                      {!script.enabled && (
                        <div className="mt-0.5"><DsBadge tone="muted">Disabled</DsBadge></div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-b border-[#F3F4F6]">
                      <DsBadge tone="muted"><span className="font-ds-mono tabular">{getPositionLabel(script.position)}</span></DsBadge>
                    </td>
                    <td className="px-4 py-3 border-b border-[#F3F4F6] max-w-[360px]">
                      <code className="text-[11.5px] text-ds-slate font-ds-mono tabular truncate block">
                        {script.content.slice(0, 120)}{script.content.length > 120 ? '…' : ''}
                      </code>
                    </td>
                    <td className="px-4 py-3 border-b border-[#F3F4F6] text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(script)}
                          className="inline-flex items-center justify-center rounded-[7px] h-7 w-7 bg-ds-card border border-ds-line text-ds-muted hover:text-ds-ink hover:bg-[#F9FAFB]"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteScript(script.id)}
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
        </DsCard>
      )}

      {showAddScript && (
        <Modal isOpen={true} onClose={() => setShowAddScript(false)} title="Add Global Script" maxWidth="2xl">
          <FormInput label="Script Name" value={newScript.name} onChange={e => setNewScript({ ...newScript, name: e.target.value })} placeholder="e.g., Google Analytics, Facebook Pixel" />
          <FormSelect label="Position" value={newScript.position} onChange={e => setNewScript({ ...newScript, position: e.target.value as 'HEAD' | 'BODY_START' | 'BODY_END' })}>
            {POSITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </FormSelect>
          <FormTextarea label="Script Code" value={newScript.content} onChange={e => setNewScript({ ...newScript, content: e.target.value })} placeholder="<script>...</script>" rows={10} className="font-mono" />
          <div className="flex gap-3 mt-6">
            <DsButton variant="default" onClick={() => setShowAddScript(false)} className="flex-1">Cancel</DsButton>
            <DsButton variant="primary" onClick={handleAddScript} disabled={!newScript.name || !newScript.content || isAdding} className="flex-1">
              {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add script
            </DsButton>
          </div>
        </Modal>
      )}

      {editingScript && (
        <Modal isOpen={true} onClose={closeEditModal} title="Edit Script" maxWidth="2xl">
          <FormInput label="Script Name" value={editScript.name} onChange={e => setEditScript({ ...editScript, name: e.target.value })} />
          <FormSelect label="Position" value={editScript.position} onChange={e => setEditScript({ ...editScript, position: e.target.value as 'HEAD' | 'BODY_START' | 'BODY_END' })}>
            {POSITION_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </FormSelect>
          <FormTextarea label="Script Code" value={editScript.content} onChange={e => setEditScript({ ...editScript, content: e.target.value })} rows={10} className="font-mono" />
          <div className="flex gap-3 mt-6">
            <DsButton variant="default" onClick={closeEditModal} className="flex-1">Cancel</DsButton>
            <DsButton variant="primary" onClick={handleEditScript} disabled={!editScript.name || !editScript.content || isEditing} className="flex-1">
              {isEditing && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </DsButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
