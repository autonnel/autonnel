import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

const mocks = vi.hoisted(() => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  setConfig: vi.fn(),
  deleteConfig: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock('@/lib/config/get-config', () => ({
  getConfig: mocks.getConfig,
  setConfig: mocks.setConfig,
  deleteConfig: mocks.deleteConfig,
}));

vi.mock('@/lib/config/keys', () => ({
  ConfigKeys: { DEFAULT_CDN_URL: { key: 'cdn.default_url' } },
}));

vi.mock('@/lib/s3', async () => {
  const actual = await vi.importActual<typeof import('@/lib/s3')>('@/lib/s3');
  return {
    ...actual,
    createS3ClientFromConfig: () => ({
      client: {
        putObject: mocks.putObject,
        deleteObject: mocks.deleteObject,
      },
    }),
  };
});

import { PUT } from '@/pages/api/settings/storage';

const principal = {
  kind: 'user' as const,
  userId: 'u1',
  tenantId: toTenantId('default'),
  permissions: PermissionSet.of([toFeatureKey('SETTINGS_STORAGE')]),
};

function run(body: unknown): Promise<Response> {
  const ctx = {
    request: new Request('https://admin.example/api/settings/storage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
    locals: {},
  };
  return runWithContext({ tenantId: toTenantId('default'), principal }, async () => (PUT as any)(ctx));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.putObject.mockResolvedValue(undefined);
  mocks.deleteObject.mockResolvedValue(undefined);
});

describe('PUT /api/settings/storage', () => {
  it('rejects private staticDomain verification URLs before persisting config', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await run({
      endpoint: 'https://s3.example.com',
      region: 'auto',
      bucket: 'bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      staticDomain: 'http://127.0.0.1',
    });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.setConfig).not.toHaveBeenCalled();
  });
});
