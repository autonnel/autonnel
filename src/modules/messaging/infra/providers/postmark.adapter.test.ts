import { describe, it, expect, vi, afterEach } from 'vitest';
import { PostmarkEmailAdapter } from './postmark.adapter';

const sendInput = { from: 'shop@store.com', to: 'b@x.com', subject: 's', html: '<p>h</p>', text: 'h', headers: {} };

describe('PostmarkEmailAdapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('POSTs with X-Postmark-Server-Token and maps MessageID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ MessageID: 'pm-987', ErrorCode: 0 }), { status: 200 }));
    const adapter = new PostmarkEmailAdapter({ serverToken: 'tok' });
    const res = await adapter.send(sendInput);
    expect(res.providerMessageId).toBe('pm-987');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('api.postmarkapp.com/email');
    expect((init!.headers as any)['X-Postmark-Server-Token']).toBe('tok');
  });

  it('parseWebhook maps Delivery/Bounce/SpamComplaint record types', async () => {
    const adapter = new PostmarkEmailAdapter({ serverToken: 'tok' });
    expect((await adapter.parseWebhook({ RecordType: 'Delivery', MessageID: 'm1', Recipient: 'b@x.com', DeliveredAt: '2026-06-04T00:00:00Z' }))[0].kind).toBe('DELIVERED');
    expect((await adapter.parseWebhook({ RecordType: 'Bounce', MessageID: 'm2', Email: 'b@x.com', Type: 'HardBounce', BouncedAt: '2026-06-04T00:00:00Z' }))[0].kind).toBe('HARD_BOUNCE');
    expect((await adapter.parseWebhook({ RecordType: 'SpamComplaint', MessageID: 'm3', Email: 'b@x.com', BouncedAt: '2026-06-04T00:00:00Z' }))[0].kind).toBe('COMPLAINT');
  });
});
