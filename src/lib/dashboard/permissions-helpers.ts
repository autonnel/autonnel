
import {
  FEATURES,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  NAV_FEATURE_MAP,
  VIRTUAL_ADMIN_ROLE_ID,
  type FeatureId,
} from '@/lib/rbac/config';

export type PermissionsTab = 'roles' | 'users';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'default';

export const PERMISSION_TABS: Array<{ id: PermissionsTab; label: string; description: string }> = [
  { id: 'roles', label: 'Roles & features', description: 'Define roles and their feature access' },
  { id: 'users', label: 'Users',            description: 'Assign roles to admin users' },
];

export function resolvePermissionsTab(value: string | null | undefined): PermissionsTab {
  const v = (value || 'roles').toLowerCase();
  if (v === 'users') return 'users';
  return 'roles';
}

export interface FeatureNode {
  id: FeatureId;
  label: string;
  description: string;
}

export interface FeatureGroup {
  key: string;
  label: string;
  topFeature: FeatureId | null;
  children: FeatureNode[];
}

const GROUP_LABELS: Record<string, string> = {
  sites: 'Sites',
  funnels: 'Funnels',
  marketing: 'Marketing',
  payment: 'Payment',
  orders: 'Orders',
  analytics: 'Analytics',
  permissions: 'Permissions',
  settings: 'Settings',
};

export function buildFeatureGroups(): FeatureGroup[] {
  const navByFeature = new Map<string, string>();
  for (const [navId, featureId] of Object.entries(NAV_FEATURE_MAP)) {
    navByFeature.set(featureId, navId);
  }

  const allFeatures: FeatureNode[] = (Object.values(FEATURES) as FeatureId[]).map((id) => ({
    id,
    label: FEATURE_LABELS[id] ?? id,
    description: FEATURE_DESCRIPTIONS[id] ?? '',
  }));

  const groupKey = (f: FeatureNode): string => {
    const top = navByFeature.get(f.id);
    if (top) return top;
    const dotIdx = f.id.indexOf('.');
    return dotIdx > 0 ? f.id.slice(0, dotIdx) : f.id;
  };

  const map = new Map<string, FeatureNode[]>();
  for (const f of allFeatures) {
    const key = groupKey(f);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }

  const groups: FeatureGroup[] = [];
  for (const [key, children] of map.entries()) {
    const topFeatureId = (Object.entries(NAV_FEATURE_MAP).find(([navId]) => navId === key)?.[1]) ?? null;
    children.sort((a, b) => {
      if (a.id === topFeatureId) return -1;
      if (b.id === topFeatureId) return 1;
      return a.id.localeCompare(b.id);
    });
    groups.push({
      key,
      label: GROUP_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
      topFeature: topFeatureId as FeatureId | null,
      children,
    });
  }

  groups.sort((a, b) => a.label.localeCompare(b.label));
  return groups;
}

export interface RoleFeatureDiff {
  added: FeatureId[];
  removed: FeatureId[];
  unchanged: FeatureId[];
}

export function diffRoleFeatures(
  before: ReadonlyArray<string>,
  after: ReadonlyArray<string>,
): RoleFeatureDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added: FeatureId[] = [];
  const removed: FeatureId[] = [];
  const unchanged: FeatureId[] = [];
  for (const f of afterSet) {
    if (beforeSet.has(f)) unchanged.push(f as FeatureId);
    else added.push(f as FeatureId);
  }
  for (const f of beforeSet) {
    if (!afterSet.has(f)) removed.push(f as FeatureId);
  }
  return { added, removed, unchanged };
}

export function isRoleDirty(diff: RoleFeatureDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0;
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  features: ReadonlyArray<string>;
  userCount?: number;
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  featureCount: number;
  userCount: number;
  tone: Tone;
}

export function buildRoleList(
  roles: ReadonlyArray<RoleSummary>,
  userRoleIds: ReadonlyArray<string> = [],
): RoleListItem[] {
  const counts = new Map<string, number>();
  for (const id of userRoleIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  return roles
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      featureCount: r.features.length,
      userCount: r.userCount ?? counts.get(r.id) ?? 0,
      tone: roleTone(r),
    }))
    .sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function roleTone(role: { isSystem: boolean; features: ReadonlyArray<string> }): Tone {
  if (role.isSystem) return 'default';
  if (role.features.length === 0) return 'warn';
  return 'ok';
}

export interface UserRoleRow {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  roleNames: string[];
  hasAdminRole: boolean;
}

export function summarizeUsers(
  users: ReadonlyArray<{ id: string; email: string; name: string | null; avatar: string | null; roles: Array<{ id: string; name: string }> }>,
): UserRoleRow[] {
  return users.map((u) => {
    const roleNames = u.roles.map((r) => r.name);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      roleNames,
      hasAdminRole: u.roles.some((r) => r.id === VIRTUAL_ADMIN_ROLE_ID),
    };
  });
}

export function statusBadgeClasses(tone: Tone): string {
  switch (tone) {
    case 'ok':   return 'bg-ds-okBg border-ds-okBorder text-ds-okText';
    case 'warn': return 'bg-ds-warnBg border-ds-warnBorder text-ds-warnText';
    case 'bad':  return 'bg-ds-badBg border-ds-badBorder text-ds-badText';
    case 'muted': return 'bg-ds-surface2 border-ds-line text-ds-muted';
    default:     return 'bg-ds-surface2 border-ds-line text-ds-slate';
  }
}

export function userInitials(name: string | null | undefined, email: string): string {
  const source = name && name.trim().length > 0 ? name : (email || '?');
  return source.trim().charAt(0).toUpperCase();
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
