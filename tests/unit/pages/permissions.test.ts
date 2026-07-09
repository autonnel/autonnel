import { describe, it, expect } from 'vitest';
import {
  resolvePermissionsTab,
  PERMISSION_TABS,
  buildFeatureGroups,
  diffRoleFeatures,
  isRoleDirty,
  buildRoleList,
  roleTone,
  summarizeUsers,
  statusBadgeClasses,
  userInitials,
  formatNumber,
} from '@/lib/dashboard/permissions-helpers';
import { FEATURES, NAV_FEATURE_MAP } from '@/lib/rbac/config';

describe('resolvePermissionsTab', () => {
  it('defaults to roles', () => {
    expect(resolvePermissionsTab(null)).toBe('roles');
    expect(resolvePermissionsTab(undefined)).toBe('roles');
    expect(resolvePermissionsTab('')).toBe('roles');
    expect(resolvePermissionsTab('garbage')).toBe('roles');
  });
  it('maps users tab', () => {
    expect(resolvePermissionsTab('users')).toBe('users');
    expect(resolvePermissionsTab('USERS')).toBe('users');
  });
});

describe('PERMISSION_TABS', () => {
  it('exposes both tabs', () => {
    expect(PERMISSION_TABS.map((t) => t.id)).toEqual(['roles', 'users']);
  });
  it('every tab has label and description', () => {
    for (const t of PERMISSION_TABS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });
});

describe('buildFeatureGroups', () => {
  const groups = buildFeatureGroups();

  it('produces at least one group per nav category', () => {
    const navKeys = Object.keys(NAV_FEATURE_MAP);
    for (const key of navKeys) {
      const g = groups.find((g) => g.key === key);
      expect(g, `group ${key}`).toBeDefined();
    }
  });

  it('includes all FEATURES values across groups exactly once', () => {
    const all = (Object.values(FEATURES) as string[]).sort();
    const collected: string[] = [];
    for (const g of groups) {
      for (const f of g.children) collected.push(f.id);
    }
    expect(collected.sort()).toEqual(all);
  });

  it('puts the top-level nav feature first within its group', () => {
    const pages = groups.find((g) => g.key === 'pages');
    expect(pages).toBeDefined();
    expect(pages!.topFeature).toBe(FEATURES.PAGES);
    expect(pages!.children[0].id).toBe(FEATURES.PAGES);
  });

  it('children carry both label and description from FEATURE_LABELS/FEATURE_DESCRIPTIONS', () => {
    const pages = groups.find((g) => g.key === 'pages')!;
    const pagesCreate = pages.children.find((c) => c.id === FEATURES.PAGES_CREATE);
    expect(pagesCreate?.label).toBe('Pages: Create');
    expect(pagesCreate?.description.length).toBeGreaterThan(0);
  });

  it('groups are sorted alphabetically by label', () => {
    const labels = groups.map((g) => g.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(sorted);
  });
});

describe('diffRoleFeatures', () => {
  it('reports no changes when sets are equal', () => {
    const d = diffRoleFeatures(['a', 'b'], ['b', 'a']);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.unchanged.sort()).toEqual(['a', 'b']);
  });

  it('reports added correctly', () => {
    const d = diffRoleFeatures(['a'], ['a', 'b', 'c']);
    expect(d.added.sort()).toEqual(['b', 'c']);
    expect(d.removed).toEqual([]);
    expect(d.unchanged).toEqual(['a']);
  });

  it('reports removed correctly', () => {
    const d = diffRoleFeatures(['a', 'b', 'c'], ['a']);
    expect(d.added).toEqual([]);
    expect(d.removed.sort()).toEqual(['b', 'c']);
    expect(d.unchanged).toEqual(['a']);
  });

  it('reports both added and removed', () => {
    const d = diffRoleFeatures(['a', 'b'], ['b', 'c']);
    expect(d.added).toEqual(['c']);
    expect(d.removed).toEqual(['a']);
    expect(d.unchanged).toEqual(['b']);
  });

  it('handles empty inputs', () => {
    const d = diffRoleFeatures([], []);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.unchanged).toEqual([]);
  });
});

describe('isRoleDirty', () => {
  it('false when no added or removed', () => {
    expect(isRoleDirty({ added: [], removed: [], unchanged: ['a' as any] })).toBe(false);
  });
  it('true when added present', () => {
    expect(isRoleDirty({ added: ['x' as any], removed: [], unchanged: [] })).toBe(true);
  });
  it('true when removed present', () => {
    expect(isRoleDirty({ added: [], removed: ['x' as any], unchanged: [] })).toBe(true);
  });
});

describe('buildRoleList', () => {
  const roles = [
    { id: 'r1', name: 'admin', description: 'system admin', isSystem: true,  features: ['sites', 'funnels'], userCount: 1 },
    { id: 'r2', name: 'viewer', description: null, isSystem: true,  features: [], userCount: 5 },
    { id: 'r3', name: 'cs',    description: null, isSystem: false, features: ['orders.view'], userCount: 2 },
    { id: 'r4', name: 'beta',  description: null, isSystem: false, features: [] },
  ];

  it('puts system roles first then alphabetical by name', () => {
    // names: r1=admin (system), r2=viewer (system), r3=cs, r4=beta
    // sort: admin, viewer (system, by name), then beta, cs (alpha)
    const out = buildRoleList(roles, ['r1', 'r2', 'r2', 'r3']);
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'r4', 'r3']);
  });

  it('falls back to userRoleIds count when role.userCount is undefined', () => {
    const out = buildRoleList(roles, ['r4', 'r4', 'r4']);
    const beta = out.find((r) => r.id === 'r4')!;
    expect(beta.userCount).toBe(3);
  });

  it('prefers role.userCount when present', () => {
    const out = buildRoleList(roles, ['r1', 'r1', 'r1']);
    const admin = out.find((r) => r.id === 'r1')!;
    expect(admin.userCount).toBe(1);
  });

  it('non-system role with no features is warn-toned', () => {
    const out = buildRoleList(roles);
    const beta = out.find((r) => r.id === 'r4')!;
    expect(beta.tone).toBe('warn');
  });

  it('non-system role with features is ok-toned', () => {
    const out = buildRoleList(roles);
    const cs = out.find((r) => r.id === 'r3')!;
    expect(cs.tone).toBe('ok');
  });

  it('system roles are default-toned', () => {
    const out = buildRoleList(roles);
    const admin = out.find((r) => r.id === 'r1')!;
    expect(admin.tone).toBe('default');
  });

  it('exposes feature counts', () => {
    const out = buildRoleList(roles);
    expect(out.find((r) => r.id === 'r1')?.featureCount).toBe(2);
    expect(out.find((r) => r.id === 'r4')?.featureCount).toBe(0);
  });
});

describe('roleTone', () => {
  it('default for system roles regardless of features', () => {
    expect(roleTone({ isSystem: true, features: [] })).toBe('default');
    expect(roleTone({ isSystem: true, features: ['sites'] })).toBe('default');
  });
  it('warn for non-system with no features', () => {
    expect(roleTone({ isSystem: false, features: [] })).toBe('warn');
  });
  it('ok for non-system with features', () => {
    expect(roleTone({ isSystem: false, features: ['sites'] })).toBe('ok');
  });
});

describe('summarizeUsers', () => {
  it('extracts role names + admin flag (admin via virtual role id)', () => {
    const out = summarizeUsers([
      {
        id: 'u1',
        email: 'a@b.com',
        name: null,
        avatar: null,
        roles: [
          { id: '__admin__', name: 'Admin' },
          { id: 'r2', name: 'cs' },
        ],
      },
      {
        id: 'u2',
        email: 'c@d.com',
        name: 'Carl',
        avatar: null,
        roles: [{ id: 'r2', name: 'cs' }],
      },
    ]);
    expect(out[0].roleNames).toEqual(['Admin', 'cs']);
    expect(out[0].hasAdminRole).toBe(true);
    expect(out[1].roleNames).toEqual(['cs']);
    expect(out[1].hasAdminRole).toBe(false);
  });
  it('handles users with no roles', () => {
    const out = summarizeUsers([
      { id: 'u1', email: 'a@b.com', name: null, avatar: null, roles: [] },
    ]);
    expect(out[0].roleNames).toEqual([]);
    expect(out[0].hasAdminRole).toBe(false);
  });
});

describe('statusBadgeClasses', () => {
  it('returns correct palette per tone', () => {
    expect(statusBadgeClasses('ok')).toContain('ds-okBg');
    expect(statusBadgeClasses('warn')).toContain('ds-warnBg');
    expect(statusBadgeClasses('bad')).toContain('ds-badBg');
    expect(statusBadgeClasses('muted')).toContain('ds-muted');
    expect(statusBadgeClasses('default')).toContain('ds-slate');
  });
});

describe('userInitials', () => {
  it('uses name first char if name present', () => {
    expect(userInitials('Alice', 'a@b.com')).toBe('A');
    expect(userInitials('  bob ', 'b@c.com')).toBe('B');
  });
  it('falls back to email when name missing or blank', () => {
    expect(userInitials(null, 'carl@x.com')).toBe('C');
    expect(userInitials('', 'dan@x.com')).toBe('D');
    expect(userInitials('   ', 'erin@x.com')).toBe('E');
  });
  it('returns ? when both empty', () => {
    expect(userInitials(null, '')).toBe('?');
  });
});

describe('formatNumber', () => {
  it('formats with thousands separators', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1500)).toBe('1,500');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  it('handles non-finite values', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('0');
  });
});
