import { describe, it, expect, vi, afterEach } from 'vitest';
import { ResendEmailAdapter } from './resend.adapter';

const sendInput = { from: 'shop@store.com', to: 'b@x.com', subject: 's', html: '<p>h</p>', text: 'h', headers: { 'List-Unsubscribe': '<x>' } };

describe('ResendEmailAdapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to the Resend API with a Bearer key and maps the message id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'resend-123' }), { status: 200 }));
    const adapter = new ResendEmailAdapter({ apiKey: 'rk_test' });
    const res = await adapter.send(sendInput);
    expect(res.providerMessageId).toBe('resend-123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('api.resend.com/emails');
    expect((init!.headers as any).Authorization).toBe('Bearer rk_test');
    const body = JSON.parse(init!.body as string);
    expect(body.to).toEqual(['b@x.com']);
    expect(body.headers['List-Unsubscribe']).toBe('<x>');
  });

  it('throws with httpStatus attached on a 5xx (so RetryPolicy can classify it transient)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 503 }));
    const adapter = new ResendEmailAdapter({ apiKey: 'rk_test' });
    await expect(adapter.send(sendInput)).rejects.toMatchObject({ httpStatus: 503 });
  });

  it('parseWebhook normalizes a delivered event', async () => {
    const adapter = new ResendEmailAdapter({ apiKey: 'rk_test' });
    const events = await adapter.parseWebhook({ type: 'email.delivered', data: { email_id: 'resend-123', to: ['b@x.com'] }, created_at: '2026-06-04T00:00:00Z' });
    expect(events[0]).toMatchObject({ providerMessageId: 'resend-123', kind: 'DELIVERED' });
  });

  it('parseWebhook maps bounce + complaint kinds', async () => {
    const adapter = new ResendEmailAdapter({ apiKey: 'rk_test' });
    const b = await adapter.parseWebhook({ type: 'email.bounced', data: { email_id: 'm1', to: ['b@x.com'], bounce: { type: 'hard' } }, created_at: '2026-06-04T00:00:00Z' });
    expect(b[0].kind).toBe('HARD_BOUNCE');
    const c = await adapter.parseWebhook({ type: 'email.complained', data: { email_id: 'm2', to: ['b@x.com'] }, created_at: '2026-06-04T00:00:00Z' });
    expect(c[0].kind).toBe('COMPLAINT');
  });
});
