import { describe, it, expect, vi, afterEach } from 'vitest';
import { CloudflareEmailAdapter, type SendEmailBinding } from './cloudflare.adapter';
import { RetryPolicy } from '../../domain/services/retry-policy';

const sendInput = { from: 'shop@store.com', fromName: 'Shop', replyTo: 'help@store.com', to: 'b@x.com', subject: 's', html: '<p>h</p>', text: 'h', headers: { 'List-Unsubscribe': '<x>' } };
const retry = new RetryPolicy();

function codedError(code: string) {
  return Object.assign(new Error(code), { code });
}

function restResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('CloudflareEmailAdapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends through the binding with a named sender and returns its messageId', async () => {
    const binding: SendEmailBinding = { send: vi.fn().mockResolvedValue({ messageId: 'cf-msg-1' }) };
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const adapter = new CloudflareEmailAdapter({ binding, accountId: 'acc', apiToken: 'tok' });
    const res = await adapter.send(sendInput);
    expect(res.providerMessageId).toBe('cf-msg-1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(binding.send).toHaveBeenCalledWith({
      to: 'b@x.com',
      from: { email: 'shop@store.com', name: 'Shop' },
      replyTo: 'help@store.com',
      subject: 's',
      html: '<p>h</p>',
      text: 'h',
      headers: { 'List-Unsubscribe': '<x>' },
    });
  });

  it('passes a bare from address when there is no sender name', async () => {
    const binding: SendEmailBinding = { send: vi.fn().mockResolvedValue({ messageId: 'm' }) };
    await new CloudflareEmailAdapter({ binding }).send({ ...sendInput, fromName: undefined });
    expect((binding.send as any).mock.calls[0][0].from).toBe('shop@store.com');
  });

  it('classifies binding rate limits as transient and sender errors as permanent', async () => {
    const limited = new CloudflareEmailAdapter({ binding: { send: vi.fn().mockRejectedValue(codedError('E_RATE_LIMIT_EXCEEDED')) } });
    const limitedErr = await limited.send(sendInput).catch((e) => e);
    expect(retry.isTransient(limitedErr)).toBe(true);

    const unverified = new CloudflareEmailAdapter({ binding: { send: vi.fn().mockRejectedValue(codedError('E_SENDER_NOT_VERIFIED')) } });
    const unverifiedErr = await unverified.send(sendInput).catch((e) => e);
    expect(unverifiedErr.message).toContain('E_SENDER_NOT_VERIFIED');
    expect(retry.isTransient(unverifiedErr)).toBe(false);
  });

  it('treats an uncoded binding failure as transient', async () => {
    const adapter = new CloudflareEmailAdapter({ binding: { send: vi.fn().mockRejectedValue(new Error('internal')) } });
    const err = await adapter.send(sendInput).catch((e) => e);
    expect(retry.isTransient(err)).toBe(true);
  });

  it('falls back to the REST API with a Bearer token and maps message_id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(restResponse({
      success: true, errors: [], messages: [],
      result: { message_id: '<abc@cf>', delivered: ['b@x.com'], queued: [], permanent_bounces: [], suppressed_recipients: [] },
    }));
    const res = await new CloudflareEmailAdapter({ accountId: 'acc', apiToken: 'tok' }).send(sendInput);
    expect(res.providerMessageId).toBe('<abc@cf>');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.cloudflare.com/client/v4/accounts/acc/email/sending/send');
    expect((init!.headers as any).Authorization).toBe('Bearer tok');
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ to: 'b@x.com', from: { address: 'shop@store.com', name: 'Shop' }, reply_to: 'help@store.com' });
    expect(body.headers['List-Unsubscribe']).toBe('<x>');
  });

  it('keeps the REST status so 429/5xx retry and 4xx do not', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(restResponse({ success: false, errors: [{ code: 10004, message: 'throttled' }] }, 429));
    const adapter = new CloudflareEmailAdapter({ accountId: 'acc', apiToken: 'tok' });
    const throttled = await adapter.send(sendInput).catch((e) => e);
    expect(throttled).toMatchObject({ httpStatus: 429 });
    expect(throttled.message).toContain('10004 throttled');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(restResponse({ success: false, errors: [{ code: 10101, message: 'unauthorized' }] }, 403));
    const denied = await adapter.send(sendInput).catch((e) => e);
    expect(retry.isTransient(denied)).toBe(false);
  });

  it('fails permanently when the REST API reports a permanent bounce', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(restResponse({
      success: true, errors: [], messages: [],
      result: { message_id: 'm', delivered: [], queued: [], permanent_bounces: ['b@x.com'], suppressed_recipients: [] },
    }));
    const err = await new CloudflareEmailAdapter({ accountId: 'acc', apiToken: 'tok' }).send(sendInput).catch((e) => e);
    expect(err.message).toContain('permanently bounced');
    expect(retry.isTransient(err)).toBe(false);
  });

  it('fails permanently without a binding or REST credentials', async () => {
    const err = await new CloudflareEmailAdapter({}).send(sendInput).catch((e) => e);
    expect(err.message).toContain('send_email binding');
    expect(retry.isTransient(err)).toBe(false);
  });

  it('has no delivery receipts to parse', async () => {
    expect(await new CloudflareEmailAdapter({}).parseWebhook()).toEqual([]);
  });
});
