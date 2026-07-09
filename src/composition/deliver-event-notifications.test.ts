import { describe, it, expect, vi } from 'vitest';
import {
  selectMatchingPairings,
  renderEventNotification,
  deliverEventNotifications,
  type EventNotificationDeps,
} from './deliver-event-notifications';
import type { NotificationPairing } from '@/lib/services/notification-routing-types';
import type { DomainEventEnvelope } from '@/modules/shared-kernel/event-envelope';
import type { DispatchResult } from '@/lib/services/notification-dispatcher';
import { MQEventType } from '@/lib/adapters/mq/types';

function pairing(over: Partial<NotificationPairing>): NotificationPairing {
  return {
    id: 'p1',
    name: 'p1',
    enabled: true,
    events: [MQEventType.ANALYSIS_CONVERSION_COMPLETED],
    channel: { type: 'email', recipients: ['a@b.com'] },
    ...over,
  };
}

function envelope(over: Partial<DomainEventEnvelope>): DomainEventEnvelope {
  return {
    eventId: 'e1',
    type: MQEventType.ANALYSIS_CONVERSION_COMPLETED,
    tenantId: 'default',
    occurredAt: new Date('2026-06-14T10:00:00.000Z'),
    payload: {},
    correlation: {},
    ...over,
  };
}

function fakeDeps(routes: NotificationPairing[], over: Partial<EventNotificationDeps> = {}): EventNotificationDeps {
  return {
    loadRoutes: vi.fn(async () => routes),
    loadBrandName: vi.fn(async () => 'Acme'),
    queueEmail: vi.fn(async () => {}),
    deliverSlack: vi.fn(async (): Promise<DispatchResult> => ({ channel: 'slack', status: 'sent' })),
    deliverWebhook: vi.fn(async (): Promise<DispatchResult> => ({ channel: 'webhook', status: 'sent' })),
    recordChannelDispatch: vi.fn(async () => {}),
    ...over,
  };
}

describe('selectMatchingPairings', () => {
  it('keeps only enabled pairings subscribed to the event', () => {
    const routes = [
      pairing({ id: 'match' }),
      pairing({ id: 'disabled', enabled: false }),
      pairing({ id: 'other-event', events: [MQEventType.ORDER_PAID] }),
    ];
    const out = selectMatchingPairings(routes, MQEventType.ANALYSIS_CONVERSION_COMPLETED);
    expect(out.map((p) => p.id)).toEqual(['match']);
  });
});

describe('renderEventNotification', () => {
  it('renders the conversion-analysis payload with summary and analysis', () => {
    const env = envelope({
      payload: {
        runAt: '2026-06-14T10:00:00.000Z',
        timeRange: '08:00 – 10:00',
        sessionsAnalyzed: 42,
        summary: 'Sessions: 42',
        analysis: 'Improve the checkout step.',
        hasLlmInsights: true,
      },
    });
    const { subject, body } = renderEventNotification(env, 'Acme');
    expect(subject).toBe('[Acme] Conversion analysis completed');
    expect(body).toContain('Sessions analyzed: 42');
    expect(body).toContain('Sessions: 42');
    expect(body).toContain('Analysis:\nImprove the checkout step.');
  });

  it('renders a generic body for other events', () => {
    const env = envelope({ type: MQEventType.ORDER_PAID, payload: { orderId: 'o9' } });
    const { subject, body } = renderEventNotification(env, 'Acme');
    expect(subject).toBe('[Acme] Order paid');
    expect(body).toContain('Order paid');
    expect(body).toContain('"orderId":"o9"');
  });
});

describe('deliverEventNotifications fan-out', () => {
  it('queues an email through the messaging pipeline, without a separate Dispatch write', async () => {
    const deps = fakeDeps([pairing({ id: 'email', channel: { type: 'email', recipients: ['a@b.com', 'b@b.com'] } })]);
    await deliverEventNotifications(envelope({}), deps);

    expect(deps.queueEmail).toHaveBeenCalledTimes(1);
    expect(deps.queueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: ['a@b.com', 'b@b.com'],
        purpose: MQEventType.ANALYSIS_CONVERSION_COMPLETED,
        eventId: 'e1',
        pairingId: 'email',
      }),
    );
    expect(deps.recordChannelDispatch).not.toHaveBeenCalled();
    expect(deps.deliverSlack).not.toHaveBeenCalled();
  });

  it('delivers slack and writes a SENT Dispatch row', async () => {
    const deps = fakeDeps([pairing({ id: 'slack', channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' } })]);
    await deliverEventNotifications(envelope({}), deps);

    expect(deps.deliverSlack).toHaveBeenCalledTimes(1);
    expect(deps.recordChannelDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'SLACK',
        recipient: 'https://hooks.slack.com/x',
        purpose: MQEventType.ANALYSIS_CONVERSION_COMPLETED,
        pairingId: 'slack',
        result: { channel: 'slack', status: 'sent' },
      }),
    );
    expect(deps.queueEmail).not.toHaveBeenCalled();
  });

  it('delivers webhook and writes a WEBHOOK Dispatch row', async () => {
    const deps = fakeDeps([pairing({ id: 'wh', channel: { type: 'webhook', url: 'https://example.com/x', secret: 's' } })]);
    await deliverEventNotifications(envelope({}), deps);

    expect(deps.deliverWebhook).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/x', secret: 's' }));
    expect(deps.recordChannelDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'WEBHOOK', recipient: 'https://example.com/x', pairingId: 'wh' }),
    );
  });

  it('still records a FAILED Dispatch row when slack delivery fails', async () => {
    const deps = fakeDeps([pairing({ id: 'slack', channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' } })], {
      deliverSlack: vi.fn(async (): Promise<DispatchResult> => ({ channel: 'slack', status: 'failed', error: 'HTTP 500' })),
    });
    await deliverEventNotifications(envelope({}), deps);

    expect(deps.recordChannelDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'SLACK', result: { channel: 'slack', status: 'failed', error: 'HTTP 500' } }),
    );
  });

  it('does not deliver or record for a disabled pairing', async () => {
    const deps = fakeDeps([pairing({ id: 'off', enabled: false, channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' } })]);
    await deliverEventNotifications(envelope({}), deps);

    expect(deps.deliverSlack).not.toHaveBeenCalled();
    expect(deps.queueEmail).not.toHaveBeenCalled();
    expect(deps.recordChannelDispatch).not.toHaveBeenCalled();
  });

  it('does not deliver when no pairing subscribes to the event', async () => {
    const deps = fakeDeps([pairing({ id: 'other', events: [MQEventType.ORDER_PAID] })]);
    await deliverEventNotifications(envelope({ type: MQEventType.ANALYSIS_CONVERSION_COMPLETED }), deps);

    expect(deps.loadBrandName).not.toHaveBeenCalled();
    expect(deps.queueEmail).not.toHaveBeenCalled();
    expect(deps.deliverSlack).not.toHaveBeenCalled();
    expect(deps.recordChannelDispatch).not.toHaveBeenCalled();
  });

  it('maps an emitted domain event (OrderShipped) to its catalog id (order.shipped) and delivers', async () => {
    const deps = fakeDeps([
      pairing({ id: 'ship', events: [MQEventType.ORDER_SHIPPED], channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' } }),
    ]);
    await deliverEventNotifications(envelope({ type: 'OrderShipped' }), deps);

    expect(deps.deliverSlack).toHaveBeenCalledTimes(1);
    expect(deps.recordChannelDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'SLACK', purpose: MQEventType.ORDER_SHIPPED }),
    );
  });

  it('delivers a paid-on-creation order (OrderCreated) to either order.paid or order.created subscribers, purpose=order.paid', async () => {
    const deps = fakeDeps([
      pairing({ id: 'paid', events: [MQEventType.ORDER_PAID], channel: { type: 'email', recipients: ['a@b.com'] } }),
    ]);
    await deliverEventNotifications(envelope({ type: 'OrderCreated' }), deps);

    expect(deps.queueEmail).toHaveBeenCalledWith(expect.objectContaining({ purpose: MQEventType.ORDER_PAID }));
  });

  it('skips delivery (no route load) for a domain event without a catalog twin', async () => {
    const deps = fakeDeps([pairing({ id: 'any', events: [MQEventType.ORDER_PAID] })]);
    await deliverEventNotifications(envelope({ type: 'SaleHandedOff' }), deps);

    expect(deps.loadRoutes).not.toHaveBeenCalled();
    expect(deps.queueEmail).not.toHaveBeenCalled();
    expect(deps.deliverSlack).not.toHaveBeenCalled();
    expect(deps.recordChannelDispatch).not.toHaveBeenCalled();
  });

  it('isolates a failing pairing so siblings still deliver', async () => {
    const deps = fakeDeps(
      [
        pairing({ id: 'bad', channel: { type: 'email', recipients: ['a@b.com'] } }),
        pairing({ id: 'good', channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' } }),
      ],
      { queueEmail: vi.fn(async () => { throw new Error('boom'); }) },
    );
    await deliverEventNotifications(envelope({}), deps);

    expect(deps.deliverSlack).toHaveBeenCalledTimes(1);
    expect(deps.recordChannelDispatch).toHaveBeenCalledWith(expect.objectContaining({ channel: 'SLACK' }));
  });
});
