import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

const { getS3ConfigMock } = vi.hoisted(() => ({
  getS3ConfigMock: vi.fn(),
}));

vi.mock('@/lib/config/storage', () => ({
  getS3Config: getS3ConfigMock,
}));

import { GET } from '@/pages/api/settings/storage/status';

const principal = {
  kind: 'user' as const,
  userId: 'u1',
  tenantId: toTenantId('default'),
  permissions: PermissionSet.of([toFeatureKey('SETTINGS')]),
};

function run(): Promise<Response> {
  const ctx = {
    request: new Request('https://admin.example/api/settings/storage/status'),
    params: {},
    locals: {},
  };
  return runWithContext({ tenantId: toTenantId('default'), principal }, async () => (GET as any)(ctx));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/settings/storage/status', () => {
  it('returns { configured: true } when S3 config exists', async () => {
    getS3ConfigMock.mockResolvedValue({
      endpoint: 'https://s3.test',
      region: 'auto',
      bucket: 'b',
      accessKeyId: 'k',
      secretAccessKey: 's',
    });
    const res = await run();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { configured: boolean };
    expect(body.configured).toBe(true);
  });

  it('returns { configured: false } when S3 config is missing', async () => {
    getS3ConfigMock.mockResolvedValue(null);
    const res = await run();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { configured: boolean };
    expect(body.configured).toBe(false);
  });
});
