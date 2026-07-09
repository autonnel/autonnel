import { useEffect, useMemo, useState } from 'react';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { RoleDto, MemberDto } from '@/contracts/identity';
import { Input, Textarea, Checkbox, dsFieldLabelClass } from '@/components/primitives';
import { cn } from '@/lib/utils';

const VIRTUAL_ADMIN_ROLE_ID = '__admin__';

interface RoleSummary extends Omit<RoleDto, 'features'> {
  features: ReadonlyArray<string>;
  userCount: number;
}

type UserRow = MemberDto;

interface FeatureGroup {
  key: string;
  label: string;
  topFeature: string | null;
  children: Array<{ id: string; label: string; description: string }>;
}

interface RolesAndFeaturesPanelProps {
  initialRoles: RoleSummary[];
  initialUsers: UserRow[];
  featureGroups: FeatureGroup[];
  canCreateRole: boolean;
}

function classes(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(' ');
}

function badgeClasses(tone: 'ok' | 'warn' | 'bad' | 'muted' | 'default'): string {
  if (tone === 'ok')   return 'bg-ds-okBg border-ds-okBorder text-ds-okText';
  if (tone === 'warn') return 'bg-ds-warnBg border-ds-warnBorder text-ds-warnText';
  if (tone === 'bad')  return 'bg-ds-badBg border-ds-badBorder text-ds-badText';
  if (tone === 'muted') return 'bg-ds-surface2 border-ds-line text-ds-muted';
  return 'bg-ds-surface2 border-ds-line text-ds-slate';
}

export default function RolesAndFeaturesPanel({
  initialRoles,
  initialUsers,
  featureGroups,
  canCreateRole,
}: RolesAndFeaturesPanelProps) {
  const [roles, setRoles] = useState<RoleSummary[]>(initialRoles);
  const [users] = useState<UserRow[]>(initialUsers);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(initialRoles[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftFeatures, setDraftFeatures] = useState<Set<string>>(new Set());

  const selectedRole = useMemo(() => roles.find((r) => r.id === selectedRoleId) ?? null, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedRole) {
      setDraftName(selectedRole.name);
      setDraftDesc(selectedRole.description ?? '');
      setDraftFeatures(new Set(selectedRole.features));
    } else {
      setDraftName('');
      setDraftDesc('');
      setDraftFeatures(new Set());
    }
  }, [selectedRole]);

  const beforeSet = useMemo(() => new Set(selectedRole?.features ?? []), [selectedRole]);
  const isDirty = useMemo(() => {
    if (!selectedRole) return false;
    if (draftName !== selectedRole.name) return true;
    if ((draftDesc || '') !== (selectedRole.description || '')) return true;
    if (draftFeatures.size !== beforeSet.size) return true;
    for (const f of draftFeatures) if (!beforeSet.has(f)) return true;
    return false;
  }, [selectedRole, draftName, draftDesc, draftFeatures, beforeSet]);

  async function reloadRoles() {
    try {
      const [rolesData, metaData] = await Promise.all([
        apiCall('GET /api/permissions/roles', null),
        apiCall('GET /api/permissions', null).catch(() => null),
      ]);
      const newUsers = metaData ? metaData.users : users;
      const counts = new Map<string, number>();
      for (const u of newUsers) for (const r of u.roles) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
      setRoles(rolesData.roles.map((r) => ({ ...r, userCount: counts.get(r.id) ?? 0 })));
    } catch {
    }
  }

  async function handleCreateRole() {
    if (!newName.trim()) return;
    setSavingRole(true);
    setError(null);
    try {
      const data = await apiCall('POST /api/permissions/roles', { name: newName.trim(), description: newDesc.trim() || null });
      setNewName('');
      setNewDesc('');
      setCreating(false);
      await reloadRoles();
      setSelectedRoleId(data.role?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to create role');
    } finally {
      setSavingRole(false);
    }
  }

  async function handleDeleteRole(role: RoleSummary) {
    if (role.isSystem || role.id === VIRTUAL_ADMIN_ROLE_ID) return;
    if (!confirm(`Delete role "${role.name}"? Users will lose this assignment.`)) return;
    try {
      await apiCall('DELETE /api/permissions/roles/:id', null, { params: { id: role.id } });
      await reloadRoles();
      if (selectedRoleId === role.id) setSelectedRoleId(null);
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to delete role');
    }
  }

  async function handleSaveRole() {
    if (!selectedRole) return;
    if (selectedRole.id === VIRTUAL_ADMIN_ROLE_ID) return;
    setSavingRole(true);
    setError(null);
    try {
      if (!selectedRole.isSystem) {
        await apiCall('PUT /api/permissions/roles/:id', { name: draftName.trim(), description: draftDesc.trim() || null }, { params: { id: selectedRole.id } });
      }
      await apiCall('PUT /api/permissions/roles/:id/features', { featureIds: Array.from(draftFeatures) }, { params: { id: selectedRole.id } });
      await reloadRoles();
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  }

  function toggleFeature(featureId: string) {
    setDraftFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="px-3 py-2 rounded-[7px] bg-ds-badBg border border-ds-badBorder text-[12.5px] text-ds-badText">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <aside className="col-span-12 lg:col-span-5 xl:col-span-4">
          <div className="bg-ds-card border border-ds-line rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)]">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-ds-line">
              <div className="text-[14px] font-semibold text-ds-ink">Roles</div>
              {canCreateRole && (
                <button
                  type="button"
                  onClick={() => setCreating((v) => !v)}
                  className="inline-flex items-center justify-center font-medium rounded-[6px] h-7 px-2.5 text-[12px] bg-ds-ink text-ds-card hover:bg-[#1F2937]"
                >
                  + New
                </button>
              )}
            </div>

            {creating && canCreateRole && (
              <div className="px-5 py-4 border-b border-ds-line bg-ds-surface2 flex flex-col gap-2">
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Role name (e.g. customer_service)"
                />
                <Textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="Description (optional)"
                  className={cn('resize-none')}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    disabled={savingRole}
                    className="inline-flex items-center justify-center font-medium rounded-[6px] h-7 px-2.5 text-[12px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateRole}
                    disabled={savingRole || !newName.trim()}
                    className="inline-flex items-center justify-center font-medium rounded-[6px] h-7 px-2.5 text-[12px] bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            <ul className="flex flex-col py-2 max-h-[560px] overflow-y-auto">
              {roles.length === 0 ? (
                <li className="px-5 py-6 text-center text-[13px] text-ds-muted">No roles defined.</li>
              ) : (
                roles.map((r) => {
                  const isActive = r.id === selectedRoleId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRoleId(r.id)}
                        className={classes(
                          'w-full text-left px-5 py-3 flex items-start justify-between gap-3 hover:bg-ds-surface2 transition-colors border-l-2',
                          isActive ? 'bg-ds-surface2 border-ds-ink' : 'border-transparent',
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-ds-ink truncate">{r.name}</span>
                            {r.id === VIRTUAL_ADMIN_ROLE_ID ? (
                              <span className={`inline-flex items-center rounded-[6px] border px-1.5 py-[1px] text-[10.5px] font-medium ${badgeClasses('muted')}`}>
                                built-in
                              </span>
                            ) : r.isSystem && (
                              <span className={`inline-flex items-center rounded-[6px] border px-1.5 py-[1px] text-[10.5px] font-medium ${badgeClasses('muted')}`}>
                                system
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-ds-muted mt-0.5 font-ds-mono tabular">
                            {r.features.length} feature{r.features.length === 1 ? '' : 's'} · {r.userCount} user{r.userCount === 1 ? '' : 's'}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-7 xl:col-span-8">
          {!selectedRole ? (
            <div className="bg-ds-card border border-ds-line rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)] px-6 py-16 text-center text-[13px] text-ds-muted">
              Select a role on the left to edit its features.
            </div>
          ) : (
            <div className="bg-ds-card border border-ds-line rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)]">
              <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-ds-line flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[14px] font-semibold text-ds-ink">{selectedRole.name}</div>
                    {selectedRole.id === VIRTUAL_ADMIN_ROLE_ID ? (
                      <span className={`inline-flex items-center rounded-[6px] border px-1.5 py-[1px] text-[10.5px] font-medium ${badgeClasses('muted')}`}>
                        built-in
                      </span>
                    ) : selectedRole.isSystem && (
                      <span className={`inline-flex items-center rounded-[6px] border px-1.5 py-[1px] text-[10.5px] font-medium ${badgeClasses('muted')}`}>
                        system
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-ds-muted mt-0.5">
                    {selectedRole.id === VIRTUAL_ADMIN_ROLE_ID
                      ? 'Built-in admin · full access, not editable'
                      : selectedRole.isSystem ? 'System role · name is locked, features still editable' : 'Custom role'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!selectedRole.isSystem && selectedRole.id !== VIRTUAL_ADMIN_ROLE_ID && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(selectedRole)}
                      className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-card border border-ds-line text-ds-bad hover:bg-ds-badBg hover:border-ds-badBorder"
                    >
                      Delete
                    </button>
                  )}
                  {selectedRole.id !== VIRTUAL_ADMIN_ROLE_ID && (
                    <button
                      type="button"
                      onClick={handleSaveRole}
                      disabled={!isDirty || savingRole}
                      className="inline-flex items-center justify-center font-medium rounded-[7px] h-8 px-3 text-[13px] bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50"
                    >
                      {savingRole ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              </div>

              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-ds-line">
                <div>
                  <label className={dsFieldLabelClass}>Name</label>
                  <Input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    disabled={selectedRole.isSystem || selectedRole.id === VIRTUAL_ADMIN_ROLE_ID}
                    className={cn('mt-1')}
                  />
                </div>
                <div>
                  <label className={dsFieldLabelClass}>Description</label>
                  <Input
                    type="text"
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    disabled={selectedRole.isSystem || selectedRole.id === VIRTUAL_ADMIN_ROLE_ID}
                    className={cn('mt-1')}
                  />
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[13px] font-semibold text-ds-ink">Features ({draftFeatures.size})</div>
                  <div className="flex items-center gap-3 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setDraftFeatures(new Set(featureGroups.flatMap((g) => g.children.map((c) => c.id))))}
                      className="text-ds-muted hover:text-ds-ink"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftFeatures(new Set())}
                      className="text-ds-muted hover:text-ds-ink"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featureGroups.map((g) => (
                    <div key={g.key} className="border border-ds-line rounded-[8px] p-3">
                      <div className="text-[11.5px] uppercase tracking-[0.04em] text-ds-muted font-medium mb-2">
                        {g.label}
                      </div>
                      <div className="flex flex-col gap-1">
                        {g.children.map((f) => (
                          <label
                            key={f.id}
                            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-ds-surface2 cursor-pointer"
                          >
                            <Checkbox
                              checked={draftFeatures.has(f.id)}
                              onChange={() => toggleFeature(f.id)}
                              disabled={selectedRole.id === VIRTUAL_ADMIN_ROLE_ID}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-ds-ink truncate">{f.label}</div>
                              <div className="text-[11px] text-ds-faint truncate font-ds-mono tabular">{f.id}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
