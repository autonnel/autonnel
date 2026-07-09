import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getRoutes: vi.fn(),
  setRoutes: vi.fn(),
  emailEnabled: vi.fn(),
  emailRecipients: vi.fn(),
  slackEnabled: vi.fn(),
  slackUrl: vi.fn(),
  webhookEnabled: vi.fn(),
  webhookUrl: vi.fn(),
  webhookSecret: vi.fn(),
}));

vi.mock('@/lib/config/keys', () => ({
  getNotificationsRoutes: hoisted.getRoutes,
  setNotificationsRoutes: hoisted.setRoutes,
  getNotificationsEmailEnabled: hoisted.emailEnabled,
  getNotificationsEmailRecipients: hoisted.emailRecipients,
  getNotificationsSlackEnabled: hoisted.slackEnabled,
  getNotificationsSlackWebhookUrl: hoisted.slackUrl,
  getNotificationsWebhookEnabled: hoisted.webhookEnabled,
  getNotificationsWebhookUrl: hoisted.webhookUrl,
  getNotificationsWebhookSecret: hoisted.webhookSecret,
}));

import { ensureNotificationRoutes } from '@/lib/services/notification-routes-migration';

beforeEach(() => {
  for (const fn of Object.values(hoisted)) (fn as { mockReset: () => void }).mockReset();
  hoisted.getRoutes.mockResolvedValue(undefined);
  hoisted.emailEnabled.mockResolvedValue(undefined);
  hoisted.emailRecipients.mockResolvedValue(undefined);
  hoisted.slackEnabled.mockResolvedValue(undefined);
  hoisted.slackUrl.mockResolvedValue(undefined);
  hoisted.webhookEnabled.mockResolvedValue(undefined);
  hoisted.webhookUrl.mockResolvedValue(undefined);
  hoisted.webhookSecret.mockResolvedValue(undefined);
  hoisted.setRoutes.mockResolvedValue(undefined);
});

describe('ensureNotificationRoutes', () => {
  it('returns existing array when present (no migration)', async () => {
    hoisted.getRoutes.mockResolvedValue([
      { id: 'p1', name: 'x', enabled: true, events: [], channel: { type: 'slack', webhookUrl: 'https://x' } },
    ]);
    const r = await ensureNotificationRoutes();
    expect(r).toHaveLength(1);
    expect(hoisted.setRoutes).not.toHaveBeenCalled();
  });

  it('returns empty array (and persists it) when no legacy config exists', async () => {
    const r = await ensureNotificationRoutes();
    expect(r).toEqual([]);
    expect(hoisted.setRoutes).toHaveBeenCalledWith([]);
  });

  it('migrates enabled email channel with recipients', async () => {
    hoisted.emailEnabled.mockResolvedValue(true);
    hoisted.emailRecipients.mockResolvedValue(['a@x.com']);
    const r = await ensureNotificationRoutes();
    expect(r).toHaveLength(1);
    expect(r[0].channel).toMatchObject({ type: 'email', recipients: ['a@x.com'] });
    expect(r[0].events).toEqual(['analysis.conversion_completed']);
    expect(r[0].enabled).toBe(true);
    expect(hoisted.setRoutes).toHaveBeenCalledTimes(1);
  });

  it('skips enabled email channel without recipients', async () => {
    hoisted.emailEnabled.mockResolvedValue(true);
    hoisted.emailRecipients.mockResolvedValue([]);
    const r = await ensureNotificationRoutes();
    expect(r).toEqual([]);
  });

  it('migrates slack with URL', async () => {
    hoisted.slackEnabled.mockResolvedValue(true);
    hoisted.slackUrl.mockResolvedValue('https://hooks.slack.com/x');
    const r = await ensureNotificationRoutes();
    expect(r[0].channel).toMatchObject({ type: 'slack', webhookUrl: 'https://hooks.slack.com/x' });
  });

  it('migrates webhook with optional secret', async () => {
    hoisted.webhookEnabled.mockResolvedValue(true);
    hoisted.webhookUrl.mockResolvedValue('https://example.com/x');
    hoisted.webhookSecret.mockResolvedValue('shh');
    const r = await ensureNotificationRoutes();
    expect(r[0].channel).toMatchObject({ type: 'webhook', url: 'https://example.com/x', secret: 'shh' });
  });

  it('migrates multiple channels into multiple pairings', async () => {
    hoisted.emailEnabled.mockResolvedValue(true);
    hoisted.emailRecipients.mockResolvedValue(['a@x.com']);
    hoisted.slackEnabled.mockResolvedValue(true);
    hoisted.slackUrl.mockResolvedValue('https://hooks.slack.com/x');
    const r = await ensureNotificationRoutes();
    expect(r).toHaveLength(2);
    expect(r.map((p) => p.channel.type).sort()).toEqual(['email', 'slack']);
  });

  it('does not re-run when called twice (saved empty array prevents re-migration)', async () => {
    hoisted.getRoutes.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
    await ensureNotificationRoutes();
    await ensureNotificationRoutes();
    expect(hoisted.setRoutes).toHaveBeenCalledTimes(1);
  });
});
