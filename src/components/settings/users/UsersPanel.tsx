import { useEffect, useRef, useState } from 'react';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { MemberDto, InvitationDto } from '@/contracts/identity';
import { Input, dsSelectClass } from '@/components/primitives';
import { cn } from '@/lib/utils';

const VIRTUAL_ADMIN_ROLE_ID = '__admin__';

interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  features: ReadonlyArray<string>;
  userCount?: number;
}

type UserRow = MemberDto;
type InvitationRow = InvitationDto;

interface UsersPanelProps {
  initialUsers: UserRow[];
  initialRoles: RoleSummary[];
  initialInvitations: InvitationRow[];
}

function classes(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(' ');
}

function userInitial(u: UserRow): string {
  const src = u.name && u.name.trim().length > 0 ? u.name : (u.email || '');
  return (src || '?').trim().charAt(0).toUpperCase();
}

function RoleDropdown({
  userId,
  currentRoles,
  allRoles,
  busy,
  onToggle,
}: {
  userId: string;
  currentRoles: Array<{ id: string; name: string }>;
  allRoles: RoleSummary[];
  busy: boolean;
  onToggle: (userId: string, roleId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentIds = new Set(currentRoles.map((r) => r.id));
  const label = currentRoles.length === 0
    ? 'No roles'
    : currentRoles.map((r) => r.name).join(', ');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={classes(
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[12.5px] font-medium transition-colors min-w-[120px]',
          currentRoles.length === 0
            ? 'bg-ds-card border-ds-line text-ds-muted hover:border-ds-linehi'
            : 'bg-ds-surface2 border-ds-line text-ds-ink hover:border-ds-linehi',
          busy && 'opacity-50 cursor-wait',
        )}
      >
        <span className="flex-1 text-left truncate max-w-[180px]">{label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 shrink-0 text-ds-muted">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-40 w-52 bg-ds-card border border-ds-line rounded-[8px] shadow-[0_8px_24px_rgba(17,24,39,0.12)] py-1"
        >
          {allRoles.map((r) => {
            const has = currentIds.has(r.id);
            const isAdmin = r.id === VIRTUAL_ADMIN_ROLE_ID;
            return (
              <button
                key={r.id}
                type="button"
                role="menuitem"
                onClick={() => { onToggle(userId, r.id); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-left hover:bg-ds-surface2 transition-colors"
              >
                <span className={classes(
                  'inline-flex items-center justify-center w-4 h-4 rounded border transition-colors',
                  has
                    ? 'bg-ds-ink border-ds-ink text-ds-card'
                    : 'border-ds-line text-transparent',
                )}>
                  {has && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5">
                      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="flex-1 truncate">{isAdmin ? 'Admin (full access)' : r.name}</span>
                {isAdmin ? (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-ds-surface2 border border-ds-line text-ds-muted font-medium">built-in</span>
                ) : r.isSystem && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-ds-surface2 border border-ds-line text-ds-muted font-medium">system</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function UsersPanel({ initialUsers, initialRoles, initialInvitations }: UsersPanelProps) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [roles] = useState<RoleSummary[]>(initialRoles);
  const [busy, setBusy] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<InvitationRow[]>(initialInvitations);
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<string>(initialRoles[0]?.name ?? '');
  const [creatingInv, setCreatingInv] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshInvitations() {
    try {
      const data = await apiCall('GET /api/auth/invitations', null);
      setInvitations(data.invitations);
    } catch {
    }
  }

  async function handleToggleUserRole(userId: string, roleId: string) {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const has = u.roles.some((r) => r.id === roleId);
    let newIds: string[];
    if (roleId === VIRTUAL_ADMIN_ROLE_ID) {
      newIds = has ? [] : [VIRTUAL_ADMIN_ROLE_ID];
    } else if (has) {
      newIds = u.roles.filter((r) => r.id !== roleId && r.id !== VIRTUAL_ADMIN_ROLE_ID).map((r) => r.id);
    } else {
      const without = u.roles.filter((r) => r.id !== VIRTUAL_ADMIN_ROLE_ID).map((r) => r.id);
      newIds = [...without, roleId];
    }
    setBusy(userId);
    try {
      await apiCall('PUT /api/permissions/users/:userId/roles', { roleIds: newIds }, { params: { userId } });
      const newRoleObjs = roles
        .filter((r) => newIds.includes(r.id))
        .map((r) => ({ id: r.id, name: r.name }));
      setUsers((prev) => prev.map((x) => (x.id === userId ? { ...x, roles: newRoleObjs } : x)));
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to save');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateInvitation() {
    const email = invEmail.trim();
    if (!email || !invRole) return;
    setCreatingInv(true);
    setError(null);
    try {
      await apiCall('POST /api/auth/invite', { email, role: invRole });
      setInvEmail('');
      await refreshInvitations();
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Failed to invite');
    } finally {
      setCreatingInv(false);
    }
  }

  async function handleRevokeInvitation(id: string) {
    if (!confirm('Revoke this invitation? The link will stop working immediately.')) return;
    try {
      await apiCall('DELETE /api/auth/invitations/:id', null, { params: { id } });
      await refreshInvitations();
    } catch (err) {
      alert(err instanceof ApiCallError ? err.message : 'Failed to revoke');
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/register?token=${token}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => prompt('Copy invitation link:', url));
    } else {
      prompt('Copy invitation link:', url);
    }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    } catch {
      return iso;
    }
  }

  function invitationStatus(inv: InvitationRow): { label: string; tone: 'ok' | 'warn' | 'muted' | 'bad' } {
    if (inv.acceptedAt) return { label: 'Accepted', tone: 'ok' };
    const expiresAt = new Date(inv.expiresAt).getTime();
    if (!isFinite(expiresAt) || expiresAt < Date.now()) return { label: 'Expired', tone: 'bad' };
    return { label: 'Pending', tone: 'warn' };
  }

  function toneClasses(tone: 'ok' | 'warn' | 'muted' | 'bad'): string {
    if (tone === 'ok') return 'bg-ds-okBg border-ds-okBorder text-ds-okText';
    if (tone === 'warn') return 'bg-ds-warnBg border-ds-warnBorder text-ds-warnText';
    if (tone === 'bad') return 'bg-ds-badBg border-ds-badBorder text-ds-badText';
    return 'bg-ds-surface2 border-ds-line text-ds-muted';
  }

  const totalRows = users.length + invitations.length;

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="px-3 py-2 rounded-[7px] bg-ds-badBg border border-ds-badBorder text-[12.5px] text-ds-badText">
          {error}
        </div>
      )}

      <div className="bg-ds-card border border-ds-line rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)]">
        <div className="px-5 pt-4 pb-1">
          <div className="text-[12.5px] text-ds-muted">
            <span className="font-ds-mono tabular">{users.length}</span> user{users.length === 1 ? '' : 's'}{invitations.length > 0 && <>, <span className="font-ds-mono tabular">{invitations.length}</span> pending</>}
          </div>
        </div>

        {totalRows === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-ds-muted">No users or invitations.</div>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full border-collapse">
              <thead className="bg-ds-surface2 border-y border-ds-line">
                <tr>
                  <th className="px-5 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left">Account</th>
                  <th className="px-5 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left w-[220px]">Role</th>
                  <th className="px-5 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-left w-[100px]">Status</th>
                  <th className="px-5 py-2.5 text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted text-right w-[130px]"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={`u-${u.id}`} className="hover:bg-ds-surface2 transition-colors">
                    <td className="px-5 py-3 border-b border-[#F3F4F6]">
                      <div className="flex items-center gap-3">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-8 h-8 rounded-full border border-ds-line object-cover" />
                        ) : (
                          <span className="w-8 h-8 rounded-full bg-ds-ink text-ds-card text-[13px] font-semibold flex items-center justify-center shrink-0">
                            {userInitial(u)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ds-ink truncate">{u.name || u.email || u.id.slice(0, 8)}</div>
                          <div className="text-[11.5px] text-ds-muted truncate font-ds-mono tabular">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 border-b border-[#F3F4F6]">
                      <RoleDropdown
                        userId={u.id}
                        currentRoles={u.roles}
                        allRoles={roles}
                        busy={busy === u.id}
                        onToggle={handleToggleUserRole}
                      />
                    </td>
                    <td className="px-5 py-3 border-b border-[#F3F4F6]">
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-ds-muted">
                        <span className="w-[6px] h-[6px] rounded-full bg-[#16A34A]" />
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-3 border-b border-[#F3F4F6]" />
                  </tr>
                ))}
                {invitations.map((inv) => {
                  const status = invitationStatus(inv);
                  const canRevoke = !inv.acceptedAt;
                  return (
                    <tr key={`inv-${inv.id}`} className="hover:bg-ds-surface2 transition-colors">
                      <td className="px-5 py-3 border-b border-[#F3F4F6]">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-ds-surface2 border border-ds-line text-ds-muted flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <path d="m2 5 10 8 10-8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-ds-ink truncate">{inv.email}</div>
                            <div className="text-[11.5px] text-ds-muted">Expires {formatDate(inv.expiresAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 border-b border-[#F3F4F6]">
                        <span className="text-[12.5px] text-ds-ink">{inv.role}</span>
                      </td>
                      <td className="px-5 py-3 border-b border-[#F3F4F6]">
                        <span className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[11.5px] font-medium leading-none ${toneClasses(status.tone)}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 border-b border-[#F3F4F6] text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {!inv.acceptedAt && (
                            <button
                              type="button"
                              onClick={() => copyInviteLink(inv.token)}
                              className="inline-flex items-center justify-center font-medium rounded-[6px] h-7 px-2.5 text-[12px] bg-ds-card border border-ds-line text-ds-ink hover:bg-[#F9FAFB]"
                            >
                              Copy link
                            </button>
                          )}
                          {canRevoke && (
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              className="inline-flex items-center justify-center font-medium rounded-[6px] h-7 px-2.5 text-[12px] bg-ds-card border border-ds-line text-ds-bad hover:bg-ds-badBg hover:border-ds-badBorder"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-ds-line px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[11.5px] uppercase tracking-[0.02em] font-medium text-ds-muted shrink-0 w-8">Invite</span>
          <Input
            type="email"
            value={invEmail}
            onChange={(e) => setInvEmail(e.target.value)}
            placeholder="email@example.com"
            className={cn('flex-1 min-w-0')}
          />
          <select
            value={invRole}
            onChange={(e) => setInvRole(e.target.value)}
            className={cn(dsSelectClass, 'h-8 w-auto shrink-0 min-w-[140px]')}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateInvitation}
            disabled={creatingInv || !invEmail.trim() || !invRole}
            className="inline-flex items-center justify-center font-medium rounded-lg h-8 px-4 text-[13px] bg-ds-ink text-ds-card hover:bg-[#1F2937] disabled:opacity-50 shrink-0"
          >
            {creatingInv ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
