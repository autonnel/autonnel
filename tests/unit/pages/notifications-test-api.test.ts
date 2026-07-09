import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWithContext } from '@/modules/identity/infra/als-tenant-context';
import { PermissionSet } from '@/modules/identity/domain/permission-set';
import { toFeatureKey } from '@/modules/identity/domain/feature-key';
import { toTenantId } from '@/modules/shared-kernel/tenant-id';

const hoisted = vi.hoisted(() => ({
  sendTest: vi.fn(),
  getRoutes: vi.fn(),
}));

vi.mock('@/lib/services/notification-dispatcher', () => ({
  sendTestNotification: hoisted.sendTest,
}));
vi.mock('@/lib/config/keys', () => ({
  getNotificationsRoutes: hoisted.getRoutes,
}));
// The route records a best-effort Dispatch row; stub it so the unit test stays hermetic (no DB I/O).
vi.mock('@/modules/messaging/infra/prisma/dispatch.repository', () => ({
  PrismaDispatchRepository: class {
    async recordTerminal() {
      return undefined;
    }
  },
}));

import { POST } from '@/pages/api/settings/notifications/test';

const principal = {
  kind: 'user' as const,
  userId: 'u1',
  tenantId: toTenantId('default'),
  permissions: PermissionSet.of([toFeatureKey('SETTINGS_NOTIFICATIONS')]),
};

function post(body: unknown): Promise<Response> {
  const ctx = {
    request: new Request('http://x/api/settings/notifications/test', {
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
  hoisted.sendTest.mockReset();
  hoisted.getRoutes.mockReset();
  hoisted.sendTest.mockResolvedValue({ channel: 'slack', status: 'sent' });
  hoisted.getRoutes.mockResolvedValue([]);
});

describe('POST /api/settings/notifications/test', () => {
  it('rejects missing pairing', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('sends test via the supplied pairing', async () => {
    const res = await post({
      pairing: {
        id: 'p1',
        name: 'Slack',
        enabled: true,
        events: [],
        channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' },
      },
    });
    expect(res.status).toBe(200);
    expect(hoisted.sendTest).toHaveBeenCalledTimes(1);
    const call = hoisted.sendTest.mock.calls[0][0];
    expect(call.pairing.channel.webhookUrl).toBe('https://hooks.slack.com/x');
  });

  it('falls back to stored secret when client sends blank for known id', async () => {
    hoisted.getRoutes.mockResolvedValue([
      {
        id: 'p1',
        name: 'Webhook',
        enabled: true,
        events: [],
        channel: { type: 'webhook', url: 'https://example.com/x', secret: 'stored-secret' },
      },
    ]);
    await post({
      pairing: {
        id: 'p1',
        name: 'Webhook',
        enabled: true,
        events: [],
        channel: { type: 'webhook', url: '', secret: '' },
      },
    });
    const call = hoisted.sendTest.mock.calls[0][0];
    expect(call.pairing.channel.url).toBe('https://example.com/x');
    expect(call.pairing.channel.secret).toBe('stored-secret');
  });
});
