import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { sendTestNotification } from '@/lib/services/notification-dispatcher';
import { sendAdHocEmail } from '@/composition/make-messaging';
import { getNotificationsRoutes } from '@/lib/config/keys';
import { PrismaDispatchRepository } from '@/modules/messaging/infra/prisma/dispatch.repository';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import type { NotificationPairing } from '@/lib/services/notification-routing-types';
import type { NotificationTestResult } from '@/contracts/settings';

function channelTarget(p: NotificationPairing): { channel: string; recipient: string } {
  const ch = p.channel;
  if (ch.type === 'slack') return { channel: 'SLACK', recipient: ch.webhookUrl };
  if (ch.type === 'webhook') return { channel: 'WEBHOOK', recipient: ch.url };
  return { channel: 'EMAIL', recipient: ch.recipients[0] ?? '' };
}

function fillStoredSecrets(incoming: NotificationPairing, stored: NotificationPairing[]): NotificationPairing {
  const prev = stored.find((s) => s.id === incoming.id);
  if (!prev) return incoming;
  if (incoming.channel.type === 'slack' && prev.channel.type === 'slack' && !incoming.channel.webhookUrl) {
    return { ...incoming, channel: { ...incoming.channel, webhookUrl: prev.channel.webhookUrl } };
  }
  if (incoming.channel.type === 'webhook' && prev.channel.type === 'webhook') {
    const next = { ...incoming.channel } as { type: 'webhook'; url: string; secret?: string };
    if (!next.url) next.url = prev.channel.url;
    if (!next.secret && prev.channel.secret) next.secret = prev.channel.secret;
    return { ...incoming, channel: next };
  }
  return incoming;
}

export const POST = defineRoute('POST /api/settings/notifications/test', { feature: 'SETTINGS_NOTIFICATIONS' }, async ({ input }): Promise<NotificationTestResult> => {
  const pairing = input?.pairing as NotificationPairing | undefined;
  if (!pairing || typeof pairing !== 'object' || !pairing.channel) throw new ApiError(400, 'pairing required');

  const stored = (await getNotificationsRoutes()) ?? [];
  const filled = fillStoredSecrets(pairing, stored);
  const tenantId = getCurrentTenantId();
  const result = await sendTestNotification({ tenantId, pairing: filled, send: (i) => sendAdHocEmail(i) });

  const target = channelTarget(filled);
  await new PrismaDispatchRepository(getTenantPrisma())
    .recordTerminal({
      idempotencyKey: `notify:test:${filled.id}:${crypto.randomUUID()}`,
      channel: target.channel,
      recipient: target.recipient,
      templateKey: 'notification.event',
      sourceContext: 'notifications',
      sourceEventId: 'test',
      subject: '[Autonnel] Test notification',
      status: result.status === 'sent' ? 'SENT' : 'FAILED',
      error: result.error,
    })
    .catch(() => {});

  if (result.status === 'sent') return { ok: true };
  return { ok: false, error: result.error ?? 'Send failed' };
});
