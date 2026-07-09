import { useState } from 'react';
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';
import Modal from '../primitives/Modal';
import FormInput from '../primitives/FormInput';
import FormSelect from '../primitives/FormSelect';
import FormTextarea from '../primitives/FormTextarea';
import { Checkbox } from '../primitives';
import DsButton from '../primitives/ds/Button';
import DsCard from '../primitives/ds/Card';
import DsBadge from '../primitives/ds/Badge';
import { apiCall } from '@/lib/api/client';
import type { FunnelScriptDto, ScriptPosition } from '@/contracts/funnel';

interface FunnelCustomCodeProps {
  funnelId: string;
  initialScripts: FunnelScriptDto[];
}

interface ScriptDraft {
  name: string;
  position: ScriptPosition;
  content: string;
}

const EMPTY_DRAFT: ScriptDraft = { name: '', position: 'HEAD', content: '' };

const POSITION_OPTIONS: { value: ScriptPosition; label: string }[] = [
  { value: 'HEAD', label: 'Inside <head>' },
  { value: 'BODY_START', label: 'After <body> opening' },
  { value: 'BODY_END', label: 'Before </body> closing' },
];

function getPositionLabel(position: ScriptPosition): string {
  switch (position) {
    case 'HEAD':
      return '<head>';
    case 'BODY_START':
      return '<body> start';
    case 'BODY_END':
      return '<body> end';
    default:
      return position;
  }
}

export default function FunnelCustomCode({ funnelId, initialScripts }: FunnelCustomCodeProps) {
  const [scripts, setScripts] = useState<FunnelScriptDto[]>(initialScripts);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newScript, setNewScript] = useState<ScriptDraft>(EMPTY_DRAFT);
  const [isAdding, setIsAdding] = useState(false);
  const [editingScript, setEditingScript] = useState<FunnelScriptDto | null>(null);
  const [editScript, setEditScript] = useState<ScriptDraft>(EMPTY_DRAFT);
  const [isEditing, setIsEditing] = useState(false);

  async function handleAdd() {
    if (!newScript.name || !newScript.content) return;
    setIsAdding(true);
    try {
      const created = await apiCall(
        'POST /api/funnel/:funnelId/custom-code',
        {
          name: newScript.name,
          position: newScript.position,
          content: newScript.content,
          isActive: true,
          order: scripts.length,
        },
        { params: { funnelId } },
      );
      setScripts((prev) => [...prev, created]);
      setShowAddModal(false);
      setNewScript(EMPTY_DRAFT);
    } catch {
      alert('Failed to add script');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(scriptId: string) {
    if (!confirm('Are you sure you want to delete this script?')) return;
    try {
      await apiCall('DELETE /api/funnel/:funnelId/custom-code', null, {
        params: { funnelId },
        query: { scriptId },
      });
      setScripts((prev) => prev.filter((s) => s.id !== scriptId));
    } catch {
      alert('Failed to delete script');
    }
  }

  async function handleToggle(scriptId: string, isActive: boolean) {
    try {
      await apiCall(
        'PUT /api/funnel/:funnelId/custom-code',
        { scriptId, isActive },
        { params: { funnelId } },
      );
      setScripts((prev) => prev.map((s) => (s.id === scriptId ? { ...s, isActive } : s)));
    } catch {
      console.error('Failed to update script');
    }
  }

  function openEditModal(script: FunnelScriptDto) {
    setEditingScript(script);
    setEditScript({ name: script.name, position: script.position, content: script.content });
  }

  function closeEditModal() {
    setEditingScript(null);
    setEditScript(EMPTY_DRAFT);
  }

  async function handleEdit() {
    if (!editingScript || !editScript.name || !editScript.content) return;
    setIsEditing(true);
    try {
      const updated = await apiCall(
        'PUT /api/funnel/:funnelId/custom-code',
        {
          scriptId: editingScript.id,
          name: editScript.name,
          position: editScript.position,
          content: editScript.content,
        },
        { params: { funnelId } },
      );
      setScripts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      closeEditModal();
    } catch {
      alert('Failed to update script');
    } finally {
      setIsEditing(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-ds-ink">Funnel custom code</div>
          <div className="text-[12.5px] text-ds-muted mt-0.5">
            Custom code injected into every page in this funnel.
          </div>
        </div>
        <DsButton
          variant="primary"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowAddModal(true)}
        >
          Add script
        </DsButton>
      </div>

      {scripts.length === 0 ? (
        <DsCard padded={false}>
          <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-ds-surface2 border border-ds-line flex items-center justify-center">
              <svg
                className="w-6 h-6 text-ds-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  d="M16 18l6-6-6-6M8 6l-6 6 6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="text-[14px] font-semibold text-ds-ink">No funnel custom code</div>
            <div className="text-[12.5px] text-ds-muted max-w-[320px]">
              Add tracking scripts, analytics or custom code that runs on every page in this funnel.
            </div>
            <div className="mt-2">
              <DsButton variant="primary" onClick={() => setShowAddModal(true)}>
                Add your first script
              </DsButton>
            </div>
          </div>
        </DsCard>
      ) : (
        <div className="flex flex-col gap-4">
          {scripts.map((script) => (
            <DsCard key={script.id} className={script.isActive ? undefined : 'opacity-60'}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center cursor-pointer">
                    <Checkbox
                      checked={script.isActive}
                      onChange={(e) => handleToggle(script.id, e.target.checked)}
                      className="mr-2"
                    />
                    <span className="font-semibold text-[13.5px] text-ds-ink">{script.name}</span>
                  </label>
                  <DsBadge tone="muted">
                    <span className="font-ds-mono tabular">{getPositionLabel(script.position)}</span>
                  </DsBadge>
                  {!script.isActive && <DsBadge tone="muted">Disabled</DsBadge>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={() => openEditModal(script)}
                    className="inline-flex items-center justify-center rounded-[7px] h-8 w-8 bg-ds-card border border-ds-line text-ds-muted hover:text-ds-ink hover:bg-[#F9FAFB]"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => handleDelete(script.id)}
                    className="inline-flex items-center justify-center rounded-[7px] h-8 w-8 bg-ds-card border border-ds-badBorder text-ds-bad hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <pre className="bg-ds-surface2 border border-ds-line p-4 rounded-lg text-[12px] overflow-auto max-h-40 text-ds-slate font-ds-mono tabular">
                {script.content}
              </pre>
            </DsCard>
          ))}
        </div>
      )}

      {showAddModal && (
        <Modal
          isOpen
          onClose={() => setShowAddModal(false)}
          title="Add Funnel Script"
          description="Add custom JavaScript code to be injected on all pages in this funnel"
          maxWidth="2xl"
        >
          <div className="flex flex-col gap-4">
            <FormInput
              label="Script Name"
              placeholder="e.g., Google Analytics, Facebook Pixel"
              value={newScript.name}
              onChange={(e) => setNewScript((d) => ({ ...d, name: e.target.value }))}
            />
            <FormSelect
              label="Position"
              value={newScript.position}
              onChange={(e) =>
                setNewScript((d) => ({ ...d, position: e.target.value as ScriptPosition }))
              }
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FormSelect>
            <FormTextarea
              label="Script Code"
              placeholder="<script>...</script>"
              rows={10}
              value={newScript.content}
              onChange={(e) => setNewScript((d) => ({ ...d, content: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <DsButton onClick={() => setShowAddModal(false)}>Cancel</DsButton>
            <DsButton
              variant="primary"
              onClick={handleAdd}
              disabled={!newScript.name || !newScript.content || isAdding}
              leftIcon={isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              Add script
            </DsButton>
          </div>
        </Modal>
      )}

      {editingScript && (
        <Modal
          isOpen
          onClose={closeEditModal}
          title="Edit Script"
          description="Modify the script configuration"
          maxWidth="2xl"
        >
          <div className="flex flex-col gap-4">
            <FormInput
              label="Script Name"
              placeholder="e.g., Google Analytics, Facebook Pixel"
              value={editScript.name}
              onChange={(e) => setEditScript((d) => ({ ...d, name: e.target.value }))}
            />
            <FormSelect
              label="Position"
              value={editScript.position}
              onChange={(e) =>
                setEditScript((d) => ({ ...d, position: e.target.value as ScriptPosition }))
              }
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FormSelect>
            <FormTextarea
              label="Script Code"
              placeholder="<script>...</script>"
              rows={10}
              value={editScript.content}
              onChange={(e) => setEditScript((d) => ({ ...d, content: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <DsButton onClick={closeEditModal}>Cancel</DsButton>
            <DsButton
              variant="primary"
              onClick={handleEdit}
              disabled={!editScript.name || !editScript.content || isEditing}
              leftIcon={isEditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              Save changes
            </DsButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
