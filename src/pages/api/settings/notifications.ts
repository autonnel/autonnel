// Notification channel pairings — typed against src/contracts/settings.ts. KV-backed.
// Secrets (slack webhook, webhook url/secret) are masked on read and preserved on write
// when the caller submits a masked/blank value.
import { defineRoute, ApiError } from '@/lib/api/define-route';
import { getNotificationsRoutes, setNotificationsRoutes } from '@/lib/config/keys';
import { ensureNotificationRoutes } from '@/lib/services/notification-routes-migration';
import { validatePairing, type NotificationPairing } from '@/lib/services/notification-routing-types';
import { knownEventIds } from '@/lib/services/notification-events-catalog';
import type { MaskedPairingWire, NotificationPairingInput } from '@/contracts/settings';

function maskSecret(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function maskPairings(pairings: NotificationPairing[]): MaskedPairingWire[] {
  return pairings.map((p): MaskedPairingWire => {
    const ch = p.channel;
    switch (ch.type) {
      case 'email':
        return { id: p.id, name: p.name, enabled: p.enabled, events: p.events, channel: { type: 'email', recipients: ch.recipients } };
      case 'slack':
        return {
          id: p.id,
          name: p.name,
          enabled: p.enabled,
          events: p.events,
          channel: { type: 'slack', webhookUrl: maskSecret(ch.webhookUrl), webhookUrlHasStored: !!ch.webhookUrl },
        };
      case 'webhook':
        return {
          id: p.id,
          name: p.name,
          enabled: p.enabled,
          events: p.events,
          channel: {
            type: 'webhook',
            url: maskSecret(ch.url),
            urlHasStored: !!ch.url,
            secret: maskSecret(ch.secret),
            secretHasStored: !!ch.secret,
          },
        };
    }
  });
}

function mergeStoredSecrets(incoming: NotificationPairing[], stored: NotificationPairing[]): NotificationPairing[] {
  const byId = new Map(stored.map((p) => [p.id, p]));
  return incoming.map((p) => {
    const prev = byId.get(p.id);
    if (!prev) return p;
    if (p.channel.type === 'slack' && prev.channel.type === 'slack' && !p.channel.webhookUrl) {
      return { ...p, channel: { ...p.channel, webhookUrl: prev.channel.webhookUrl } };
    }
    if (p.channel.type === 'webhook' && prev.channel.type === 'webhook') {
      const next = { ...p.channel } as { type: 'webhook'; url: string; secret?: string };
      if (!next.url) next.url = prev.channel.url;
      if (next.secret === undefined || next.secret === '') {
        if (prev.channel.secret) next.secret = prev.channel.secret;
        else delete next.secret;
      }
      return { ...p, channel: next };
    }
    return p;
  });
}

export const GET = defineRoute('GET /api/settings/notifications', { feature: 'SETTINGS_NOTIFICATIONS' }, async () => {
  const pairings = await ensureNotificationRoutes();
  return { pairings: maskPairings(pairings) };
});

export const PUT = defineRoute('PUT /api/settings/notifications', { feature: 'SETTINGS_NOTIFICATIONS' }, async ({ input }) => {
  const raw = input?.pairings;
  if (!Array.isArray(raw)) throw new ApiError(400, 'pairings must be an array');

  const incoming: NotificationPairing[] = raw.map((p: NotificationPairingInput) => ({
    id: typeof p.id === 'string' && p.id.length > 0 ? p.id : newId('p'),
    name: typeof p.name === 'string' ? p.name : '',
    enabled: p.enabled === true,
    events: Array.isArray(p.events) ? p.events : [],
    channel: p.channel as NotificationPairing['channel'],
  }));

  const stored = (await getNotificationsRoutes()) ?? [];
  const merged = mergeStoredSecrets(incoming, stored);

  const ids = knownEventIds();
  for (const p of merged) {
    const r = validatePairing(p, ids);
    if (!r.ok) throw new ApiError(400, r.error || 'Invalid pairing');
  }

  await setNotificationsRoutes(merged);
  return { pairings: maskPairings(merged) };
});
