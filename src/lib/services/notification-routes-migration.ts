import {
  getNotificationsRoutes,
  setNotificationsRoutes,
  getNotificationsEmailEnabled,
  getNotificationsEmailRecipients,
  getNotificationsSlackEnabled,
  getNotificationsSlackWebhookUrl,
  getNotificationsWebhookEnabled,
  getNotificationsWebhookUrl,
  getNotificationsWebhookSecret,
} from '@/lib/config/keys';
import type { NotificationPairing } from '@/lib/services/notification-routing-types';

const DEFAULT_EVENTS = ['analysis.conversion_completed'];

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureNotificationRoutes(): Promise<NotificationPairing[]> {
  const existing = await getNotificationsRoutes();
  if (Array.isArray(existing)) return existing;

  const [emailEnabled, emailRecipients, slackEnabled, slackUrl, webhookEnabled, webhookUrl, webhookSecret] =
    await Promise.all([
      getNotificationsEmailEnabled().catch(() => undefined),
      getNotificationsEmailRecipients().catch(() => undefined),
      getNotificationsSlackEnabled().catch(() => undefined),
      getNotificationsSlackWebhookUrl().catch(() => undefined),
      getNotificationsWebhookEnabled().catch(() => undefined),
      getNotificationsWebhookUrl().catch(() => undefined),
      getNotificationsWebhookSecret().catch(() => undefined),
    ]);

  const pairings: NotificationPairing[] = [];

  const cleanRecipients = Array.isArray(emailRecipients)
    ? emailRecipients.filter((r): r is string => typeof r === 'string' && r.length > 0)
    : [];
  if (emailEnabled && cleanRecipients.length > 0) {
    pairings.push({
      id: newId('email'),
      name: 'Email',
      enabled: true,
      events: [...DEFAULT_EVENTS],
      channel: { type: 'email', recipients: cleanRecipients },
    });
  }

  if (slackEnabled && typeof slackUrl === 'string' && slackUrl.length > 0) {
    pairings.push({
      id: newId('slack'),
      name: 'Slack',
      enabled: true,
      events: [...DEFAULT_EVENTS],
      channel: { type: 'slack', webhookUrl: slackUrl },
    });
  }

  if (webhookEnabled && typeof webhookUrl === 'string' && webhookUrl.length > 0) {
    pairings.push({
      id: newId('webhook'),
      name: 'Webhook',
      enabled: true,
      events: [...DEFAULT_EVENTS],
      channel: {
        type: 'webhook',
        url: webhookUrl,
        secret: typeof webhookSecret === 'string' && webhookSecret.length > 0 ? webhookSecret : undefined,
      },
    });
  }

  await setNotificationsRoutes(pairings);
  return pairings;
}
