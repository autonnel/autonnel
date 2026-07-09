import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

const { configMock, hashMock } = vi.hoisted(() => ({
  configMock: {
    getMaintenanceConfig: vi.fn(),
    setMaintenanceConfig: vi.fn(),
  },
  hashMock: {
    hashPassword: vi.fn(async (s: string) => `hashed:${s}`),
    hashMaintenancePassword: vi.fn(async (s: string) => `hashed:${s}`),
    MAINTENANCE_PASSWORD_MIN: 4,
  },
}));

const policyState = { canEdit: true };

vi.mock('@/lib/config/keys', () => ({
  getMaintenanceConfig: configMock.getMaintenanceConfig,
  setMaintenanceConfig: configMock.setMaintenanceConfig,
}));
vi.mock('@/lib/auth/password', () => hashMock);
vi.mock('@/lib/plugins/registry', () => ({
  getPolicyHooks: () => ({
    canEditMaintenance: async () => policyState.canEdit,
    maxCustomDomains: async () => Number.POSITIVE_INFINITY,
  }),
  getUiSlot: () => undefined,
  getUiSlotList: () => [],
  getNavHidden: () => [],
}));
vi.mock('@/lib/api-helpers', async () => {
  const actual = await vi.importActual<any>('@/lib/api-helpers');
  return {
    ...actual,
    withAuth: (_feature: string, handler: any) => async (ctx: any) =>
      handler(ctx, { user: { id: 'u1' }, auth: { authenticated: true, user: { id: 'u1' } } }),
  };
});

import { GET, PATCH } from '@/pages/api/settings/maintenance';

const TENANT = toTenantId('default');
const principal = {
  kind: 'user' as const,
  userId: 'u1',
  tenantId: TENANT,
  permissions: PermissionSet.of([toFeatureKey('SETTINGS_MAINTENANCE')]),
};

function makeCtx(method: string, url: string, jsonBody?: unknown) {
  return {
    request: new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
    }),
    params: {},
    locals: {},
  } as any;
}

// PATCH is a defineRoute handler gated by requireFeature — establish an authorized principal.
function patch(jsonBody?: unknown): Promise<Response> {
  const ctx = makeCtx('PATCH', 'https://app/api/settings/maintenance', jsonBody);
  return runWithContext({ tenantId: TENANT, principal }, async () => PATCH(ctx));
}

beforeEach(() => {
  vi.clearAllMocks();
  policyState.canEdit = true;
  configMock.getMaintenanceConfig.mockResolvedValue({ enabled: false });
  configMock.setMaintenanceConfig.mockResolvedValue(undefined);
});

describe('GET /api/settings/maintenance', () => {
  it('returns current settings + canEdit flag', async () => {
    configMock.getMaintenanceConfig.mockResolvedValue({
      enabled: true,
      message: 'Back at 5pm',
      passwordHash: '$2a$04$abcdef',
    });
    const res = await GET(makeCtx('GET', 'https://app/api/settings/maintenance'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.enabled).toBe(true);
    expect(data.message).toBe('Back at 5pm');
    expect(data.hasPassword).toBe(true);
    expect(data.canEdit).toBe(true);
  });
});

describe('PATCH /api/settings/maintenance', () => {
  it('updates the toggle and message', async () => {
    const res = await patch({ enabled: true, message: '  brb  ' });
    expect(res.status).toBe(200);
    expect(configMock.setMaintenanceConfig).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, message: 'brb' }),
    );
  });

  it('rejects passwords shorter than 4 characters with 400', async () => {
    const res = await patch({ password: 'abc' });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toMatch(/at least 4 characters/i);
    expect(hashMock.hashMaintenancePassword).not.toHaveBeenCalled();
    expect(configMock.setMaintenanceConfig).not.toHaveBeenCalled();
  });

  it('accepts passwords with 4 or more characters with 200', async () => {
    const res = await patch({ password: 'abcd' });
    expect(res.status).toBe(200);
    expect(hashMock.hashMaintenancePassword).toHaveBeenCalledWith('abcd');
    expect(configMock.setMaintenanceConfig).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed:abcd' }),
    );
  });

  it('hashes the password when provided', async () => {
    const res = await patch({ password: 'long-enough-pw' });
    expect(res.status).toBe(200);
    expect(hashMock.hashMaintenancePassword).toHaveBeenCalledWith('long-enough-pw');
    expect(configMock.setMaintenanceConfig).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'hashed:long-enough-pw' }),
    );
  });

  it('clears the password when clearPassword=true', async () => {
    configMock.getMaintenanceConfig.mockResolvedValue({ enabled: false, passwordHash: 'previously-hashed' });
    const res = await patch({ clearPassword: true });
    expect(res.status).toBe(200);
    expect(configMock.setMaintenanceConfig).toHaveBeenCalledWith(
      expect.not.objectContaining({ passwordHash: expect.anything() }),
    );
  });

  it('returns 403 when canEditMaintenance hook returns false', async () => {
    policyState.canEdit = false;
    const res = await patch({ enabled: true });
    expect(res.status).toBe(403);
    expect(configMock.setMaintenanceConfig).not.toHaveBeenCalled();
  });

  it('returns 400 when no fields are provided', async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
  });
});
