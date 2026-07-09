import { describe, it, expect, vi } from 'vitest';
import { handleCreateIntent } from '../intent';

const authoritative = async () => ({ amountMinor: 1999, currencyCode: 'USD' });
const withCookie = (body: object) =>
  new Request('https://x/api/payment/intent', {
    method: 'POST',
    headers: { cookie: 'an_checkout_session=signed' },
    body: JSON.stringify(body),
  });

describe('POST /api/payment/intent', () => {
  it('charges the server-recomputed amount, ignoring any client amount', async () => {
    const service = { create: vi.fn(async (_cmd: any) => ({ intentId: 'int_1', clientHandle: { provider: 'STRIPE', kind: 'client_secret', value: 'cs_1' } })) };
    const res = await handleCreateIntent(withCookie({ saleRef: 'sale_1', captureMethod: 'automatic' }), service as any, authoritative);
    expect(res.status).toBe(200);
    expect((await res.json() as any).clientHandle.value).toBe('cs_1');
    expect(service.create).toHaveBeenCalledOnce();
    expect(service.create.mock.calls[0]![0].amount.amountMinor).toBe(1999);
  });

  it('rejects a tampered (lower) client amount as a mismatch', async () => {
    const service = { create: vi.fn() };
    const res = await handleCreateIntent(withCookie({ saleRef: 'sale_1', amountMinor: 1, currencyCode: 'USD' }), service as any, authoritative);
    expect(res.status).toBe(409);
    expect((await res.json() as any).error).toBe('amount_mismatch');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('accepts a matching client amount and charges the authoritative total', async () => {
    const service = { create: vi.fn(async (_cmd: any) => ({ intentId: 'int_1', clientHandle: { provider: 'STRIPE', kind: 'client_secret', value: 'cs_1' } })) };
    const res = await handleCreateIntent(withCookie({ saleRef: 'sale_1', amountMinor: 1999, currencyCode: 'USD' }), service as any, authoritative);
    expect(res.status).toBe(200);
    expect(service.create.mock.calls[0]![0].amount.amountMinor).toBe(1999);
  });

  it('rejects when no valid session cookie resolves an authoritative amount', async () => {
    const service = { create: vi.fn() };
    const req = new Request('https://x/api/payment/intent', { method: 'POST', body: JSON.stringify({ saleRef: 'sale_1', amountMinor: 1999, currencyCode: 'USD' }) });
    const res = await handleCreateIntent(req, service as any, async () => null);
    expect(res.status).toBe(401);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('returns 400 when saleRef is missing', async () => {
    const service = { create: vi.fn() };
    const res = await handleCreateIntent(withCookie({ amountMinor: 1999, currencyCode: 'USD' }), service as any, authoritative);
    expect(res.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('returns 422 when the cart prices to a non-positive total', async () => {
    const service = { create: vi.fn() };
    const res = await handleCreateIntent(withCookie({ saleRef: 'sale_1' }), service as any, async () => ({ amountMinor: 0, currencyCode: 'USD' }));
    expect(res.status).toBe(422);
    expect(service.create).not.toHaveBeenCalled();
  });
});
