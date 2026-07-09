import { describe, it, expect, vi } from 'vitest';
import { ProcessSendJobService } from './process-send-job.service';
import { Dispatch } from '../domain/dispatch';
import { MessageTemplate } from '../domain/message-template';
import { Address, ChannelType, DispatchStatus, SenderIdentity, TemplateKey } from '../domain/value-objects';
import { VariableSchema } from '../domain/variable-schema';

function publishedTemplate() {
  const t = MessageTemplate.create({ tenantId: 'default', templateKey: TemplateKey.of('order.receipt') });
  const v = t.addDraft({
    channel: ChannelType.EMAIL, locale: 'en', subject: 'Receipt #{{orderNumber}}',
    html: '<p>{{orderNumber}}</p>', text: '{{orderNumber}}',
    schema: VariableSchema.of([{ name: 'orderNumber', required: true }]),
  });
  t.publish(v.versionId);
  return { t, versionId: v.versionId };
}

function queuedDispatch() {
  const d = Dispatch.queue({
    tenantId: 'default', idempotencyKey: 'k1', channel: ChannelType.EMAIL,
    recipient: Address.of(ChannelType.EMAIL, 'buyer@example.com'), templateKey: TemplateKey.of('order.receipt'),
    templateVersionId: 'pending', senderIdentityId: 'pending', correlation: { sourceContext: 'order-fulfillment' },
  });
  d.id = 'disp-1';
  return d;
}

function deps(provider: any, overrides: Partial<any> = {}) {
  const { t } = publishedTemplate();
  const events: any[] = [];
  return {
    events,
    dispatchRepo: { findById: vi.fn(async () => queuedDispatch()), save: vi.fn(async (x: Dispatch) => x), findByIdempotencyKey: vi.fn(), findByProviderMessageId: vi.fn(), findRetryable: vi.fn() },
    templateRepo: { findByKey: vi.fn(async () => t), save: vi.fn(), list: vi.fn() },
    suppressionRepo: { findForAddress: vi.fn(async () => []), upsert: vi.fn(), list: vi.fn() },
    config: {
      channelProviders: vi.fn(async () => ({ primary: 'resend' })),
      defaultSender: vi.fn(async () => ({ senderIdentityId: 'sender-1', sender: SenderIdentity.of({ fromAddress: 'shop@store.com', verified: true }) })),
      unsubscribeBaseUrl: vi.fn(async () => 'https://shop.com/u'),
    },
    providers: new Map([['resend', provider]]),
    eventPublisher: { publish: vi.fn(async (e: any) => events.push(e)), publishMany: vi.fn() },
    clock: { now: () => new Date('2026-06-04T00:00:00Z') },
    ...overrides,
  };
}

describe('ProcessSendJobService', () => {
  it('renders, sends via primary provider, marks SENT, emits NotificationSent', async () => {
    const provider = { slug: 'resend', send: vi.fn(async (_message: unknown) => ({ providerMessageId: 'pm-9' })), parseWebhook: vi.fn() };
    const d = deps(provider);
    const svc = new ProcessSendJobService(d.dispatchRepo as any, d.templateRepo as any, d.suppressionRepo as any, d.config as any, d.providers as any, d.eventPublisher as any, d.clock as any);
    const res = await svc.processSend('disp-1', { locale: 'en', variables: { orderNumber: '1001' }, unsubscribeUrl: undefined });
    expect(res.status).toBe(DispatchStatus.SENT);
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect((provider.send.mock.calls[0]![0] as any).subject).toBe('Receipt #1001');
    expect(d.events.map((e) => e.type)).toContain('messaging.NotificationSent');
  });

  it('falls back to the secondary provider when the primary throws a transient error', async () => {
    const primary = { slug: 'resend', send: vi.fn(async () => { throw Object.assign(new Error('503'), { httpStatus: 503 }); }), parseWebhook: vi.fn() };
    const fallback = { slug: 'postmark', send: vi.fn(async () => ({ providerMessageId: 'pm-fb' })), parseWebhook: vi.fn() };
    const d = deps(primary, {
      config: { channelProviders: vi.fn(async () => ({ primary: 'resend', fallback: 'postmark' })), defaultSender: vi.fn(async () => ({ senderIdentityId: 's', sender: SenderIdentity.of({ fromAddress: 'a@b.com', verified: true }) })), unsubscribeBaseUrl: vi.fn(async () => 'https://shop.com/u') },
      providers: new Map([['resend', primary], ['postmark', fallback]]),
    });
    const svc = new ProcessSendJobService(d.dispatchRepo as any, d.templateRepo as any, d.suppressionRepo as any, d.config as any, d.providers as any, d.eventPublisher as any, d.clock as any);
    const res = await svc.processSend('disp-1', { locale: 'en', variables: { orderNumber: '1001' }, unsubscribeUrl: undefined });
    expect(res.status).toBe(DispatchStatus.SENT);
    expect(fallback.send).toHaveBeenCalledTimes(1);
  });

  it('marks FAILED + emits NotificationFailed when all providers fail permanently', async () => {
    const provider = { slug: 'resend', send: vi.fn(async () => { throw Object.assign(new Error('422'), { httpStatus: 422 }); }), parseWebhook: vi.fn() };
    const d = deps(provider);
    const svc = new ProcessSendJobService(d.dispatchRepo as any, d.templateRepo as any, d.suppressionRepo as any, d.config as any, d.providers as any, d.eventPublisher as any, d.clock as any);
    const res = await svc.processSend('disp-1', { locale: 'en', variables: { orderNumber: '1001' }, unsubscribeUrl: undefined });
    expect(res.status).toBe(DispatchStatus.FAILED);
    expect(d.events.map((e) => e.type)).toContain('messaging.NotificationFailed');
  });

  it('re-checks suppression immediately before send and short-circuits to SUPPRESSED', async () => {
    const provider = { slug: 'resend', send: vi.fn(), parseWebhook: vi.fn() };
    const { SuppressionEntry } = await import('../domain/suppression-entry');
    const { SuppressionReason } = await import('../domain/value-objects');
    const d = deps(provider, {
      suppressionRepo: {
        findForAddress: vi.fn(async () => [SuppressionEntry.create({ tenantId: 'default', address: Address.of(ChannelType.EMAIL, 'buyer@example.com'), reason: SuppressionReason.Complaint, source: 'p' })]),
        upsert: vi.fn(), list: vi.fn(),
      },
    });
    const svc = new ProcessSendJobService(d.dispatchRepo as any, d.templateRepo as any, d.suppressionRepo as any, d.config as any, d.providers as any, d.eventPublisher as any, d.clock as any);
    const res = await svc.processSend('disp-1', { locale: 'en', variables: { orderNumber: '1001' }, unsubscribeUrl: undefined });
    expect(res.status).toBe(DispatchStatus.SUPPRESSED);
    expect(provider.send).not.toHaveBeenCalled();
  });
});
