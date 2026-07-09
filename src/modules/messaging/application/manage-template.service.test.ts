import { describe, it, expect, vi } from 'vitest';
import { ManageTemplateService } from './manage-template.service';
import { MessageTemplate } from '../domain/message-template';
import { ChannelType } from '../domain/value-objects';

function deps() {
  const store = new Map<string, MessageTemplate>();
  return {
    store,
    templateRepo: {
      findByKey: vi.fn(async (k: string) => store.get(k) ?? null),
      save: vi.fn(async (t: MessageTemplate) => { store.set(t.templateKey.value, t); return t; }),
      list: vi.fn(async () => [...store.values()]),
    },
    principals: { requireFeature: vi.fn() },
    events: { publish: vi.fn(), publishMany: vi.fn() },
  };
}

describe('ManageTemplateService', () => {
  it('requireFeature gates the admin op', async () => {
    const d = deps();
    const svc = new ManageTemplateService(d.templateRepo as any, d.principals as any, d.events as any);
    await svc.upsertDraft({ templateKey: 'order.receipt', channel: ChannelType.EMAIL, locale: 'en', subject: 'Receipt #{{orderNumber}}', html: '<p>{{orderNumber}}</p>', text: '{{orderNumber}}', variables: [{ name: 'orderNumber', required: true }] });
    expect(d.principals.requireFeature).toHaveBeenCalledWith('SETTINGS_EMAIL');
  });

  it('upsertDraft creates a draft; publishVersion emits TemplatePublished', async () => {
    const d = deps();
    const svc = new ManageTemplateService(d.templateRepo as any, d.principals as any, d.events as any);
    const { versionId } = await svc.upsertDraft({ templateKey: 'order.receipt', channel: ChannelType.EMAIL, locale: 'en', subject: 'Receipt #{{orderNumber}}', html: '<p>{{orderNumber}}</p>', text: '{{orderNumber}}', variables: [{ name: 'orderNumber', required: true }] });
    await svc.publishVersion('order.receipt', versionId);
    const t = d.store.get('order.receipt')!;
    expect(t.currentPublished(ChannelType.EMAIL, 'en')?.versionId).toBe(versionId);
    expect((d.events.publish as any).mock.calls.some((c: any[]) => c[0].type === 'messaging.TemplatePublished')).toBe(true);
  });
});
