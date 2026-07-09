import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/runtime/env', () => ({
  readEnv: () => undefined,
  getEnv: () => undefined,
  isCloudflareRuntime: () => false,
  getBinding: () => undefined,
}));
vi.mock('@/lib/tenant/context', () => ({
  runWithTenant: (_t: unknown, fn: () => unknown) => fn(),
}));

import {
  dispatchEmail,
  dispatchSlack,
  dispatchWebhook,
  sendTestNotification,
  _internal,
} from '@/lib/services/notification-dispatcher';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dispatchEmail', () => {
  it('invokes the injected sender for every recipient', async () => {
    const send = vi.fn(async (_input: { to: string; subject: string; html: string; text: string }) => {});
    const r = await dispatchEmail({
      tenantId: 't1',
      purpose: 'order.paid',
      subject: 'subj',
      body: 'body',
      recipients: ['a@x.com', 'b@x.com'],
      send,
    });
    expect(r).toEqual({ channel: 'email', status: 'sent' });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ to: 'a@x.com', subject: 'subj', text: 'body' });
  });

  it('fails when no recipients', async () => {
    const r = await dispatchEmail({
      tenantId: 't1',
      purpose: 'x',
      subject: 's',
      body: 'b',
      recipients: [],
      send: vi.fn(async () => {}),
    });
    expect(r.status).toBe('failed');
  });

  it('fails when the sender rejects for all recipients', async () => {
    const send = vi.fn(async () => {
      throw new Error('provider down');
    });
    const r = await dispatchEmail({
      tenantId: 't1',
      purpose: 'x',
      subject: 's',
      body: 'b',
      recipients: ['a@x.com'],
      send,
    });
    expect(r.status).toBe('failed');
    expect(r.error).toContain('provider down');
  });
});

describe('dispatchSlack', () => {
  it('sends on 2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    const r = await dispatchSlack({
      tenantId: 't1',
      purpose: 'order.paid',
      subject: 'subj',
      body: 'body',
      webhookUrl: 'https://hooks.slack.com/x',
    });
    expect(r).toEqual({ channel: 'slack', status: 'sent' });
  });

  it('fails on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('err', { status: 500, statusText: 'X' })));
    const r = await dispatchSlack({
      tenantId: 't1',
      purpose: 'x',
      subject: 's',
      body: 'b',
      webhookUrl: 'https://hooks.slack.com/x',
    });
    expect(r.status).toBe('failed');
  });
});

describe('dispatchWebhook', () => {
  it('rejects private network webhook URLs before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const r = await dispatchWebhook({
      tenantId: 't1',
      purpose: 'order.paid',
      subject: 's',
      body: 'b',
      url: 'http://127.0.0.1/webhook',
    });

    expect(r.status).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends without secret, no signature header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await dispatchWebhook({
      tenantId: 't1',
      purpose: 'order.paid',
      subject: 's',
      body: 'b',
      url: 'https://example.com/x',
    });
    expect(r.status).toBe('sent');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Webhook-Signature']).toBeUndefined();
  });

  it('signs payload with HMAC-SHA256 when secret given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await dispatchWebhook({
      tenantId: 't1',
      purpose: 'order.paid',
      subject: 's',
      body: 'b',
      url: 'https://example.com/x',
      secret: 'shh',
    });
    const [, init] = fetchMock.mock.calls[0];
    const bodyStr: string = init.body;
    const expected = 'sha256=' + createHmac('sha256', 'shh').update(bodyStr).digest('hex');
    expect(init.headers['X-Webhook-Signature']).toBe(expected);
  });
});

describe('sendTestNotification', () => {
  it('dispatches email via the injected sender', async () => {
    const send = vi.fn(async () => {});
    const r = await sendTestNotification({
      tenantId: 't1',
      pairing: {
        id: 'p1',
        name: 'Email',
        enabled: true,
        events: [],
        channel: { type: 'email', recipients: ['a@x.com'] },
      },
      send,
    });
    expect(r.channel).toBe('email');
    expect(r.status).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('dispatches slack when pairing channel is slack', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    const r = await sendTestNotification({
      tenantId: 't1',
      pairing: {
        id: 'p1',
        name: 'Slack',
        enabled: true,
        events: [],
        channel: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x' },
      },
      send: vi.fn(async () => {}),
    });
    expect(r.channel).toBe('slack');
    expect(r.status).toBe('sent');
  });
});

describe('_internal', () => {
  it('exposes truncate and computeSignature', () => {
    expect(_internal.truncate('abc', 2)).toBe('ab');
    expect(_internal.computeSignature('s', 'body')).toMatch(/^sha256=[0-9a-f]+$/);
  });
});
