import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

const hoisted = vi.hoisted(() => ({ sendAdHoc: vi.fn() }));

vi.mock('@/composition/make-messaging', () => ({ sendAdHocEmail: hoisted.sendAdHoc }));

import { POST } from '@/pages/api/settings/email/test';

function post(body: unknown, features = ['SETTINGS_EMAIL']): Promise<Response> {
  const principal = {
    kind: 'user' as const,
    userId: 'u1',
    tenantId: toTenantId('default'),
    permissions: PermissionSet.of(features.map(toFeatureKey)),
  };
  const ctx = {
    request: new Request('http://x/api/settings/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
    locals: {},
  };
  return runWithContext({ tenantId: toTenantId('default'), principal }, async () => POST(ctx as never));
}

beforeEach(() => {
  hoisted.sendAdHoc.mockReset();
  hoisted.sendAdHoc.mockResolvedValue(undefined);
});

describe('POST /api/settings/email/test', () => {
  it('requires SETTINGS_EMAIL', async () => {
    const res = await post({ to: 'a@b.co' }, []);
    expect(res.status).toBe(403);
  });

  it('rejects an invalid recipient', async () => {
    const res = await post({ to: 'nope' });
    expect(res.status).toBe(400);
    expect(hoisted.sendAdHoc).not.toHaveBeenCalled();
  });

  it('sends through the saved provider', async () => {
    const res = await post({ to: ' admin@example.com ' });
    expect(await res.json()).toEqual({ ok: true });
    expect(hoisted.sendAdHoc).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@example.com', subject: '[Autonnel] Test email' }));
  });

  it('returns the provider error instead of a generic 500', async () => {
    hoisted.sendAdHoc.mockRejectedValue(new Error('cloudflare email send failed: E_SENDER_NOT_VERIFIED'));
    const res = await post({ to: 'admin@example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: 'cloudflare email send failed: E_SENDER_NOT_VERIFIED' });
  });
});
