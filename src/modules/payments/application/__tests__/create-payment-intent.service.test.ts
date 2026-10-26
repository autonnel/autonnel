import { describe, it, expect, vi } from 'vitest';
import { CreatePaymentIntentService } from '../create-payment-intent.service';
import { Money } from '../../../shared-kernel/money';
import { SaleRef, CaptureMethod } from '../../domain/value-objects';

function makeDeps() {
  const saved: any[] = [];
  const provider = {
    slug: 'STRIPE' as const,
    createIntent: vi.fn(async () => ({ providerRef: { provider: 'STRIPE' as const, providerIntentId: 'pi_1' }, clientHandle: { provider: 'STRIPE' as const, kind: 'client_secret' as const, value: 'cs_1' } })),
    authorize: vi.fn(), capture: vi.fn(), cancel: vi.fn(), getIntent: vi.fn(), refund: vi.fn(), verifyWebhookSignature: vi.fn(), parseWebhook: vi.fn(),
  };
  const repo = { save: vi.fn(async (i: any) => { saved.push(i); }), findById: vi.fn(), findByProviderRef: vi.fn(), findBySaleRef: vi.fn(async () => null), findStaleProcessing: vi.fn() };
  const config = { configuredProviders: vi.fn(async () => ['STRIPE' as const]), providerConfig: vi.fn(async () => ({})) };
  const events = { publish: vi.fn() };
  const idGen = () => 'int_1';
  return { provider, repo, config, events, saved, idGen };
}

describe('CreatePaymentIntentService', () => {
  it('creates a provider intent and returns a ClientHandle without ever writing paid state', async () => {
    const d = makeDeps();
    const svc = new CreatePaymentIntentService({
      providerFor: async () => d.provider as any,
      intentRepo: d.repo as any,
      tenantConfig: d.config as any,
      events: d.events as any,
      newIntentId: d.idGen,
    });
    const out = await svc.create({ saleRef: SaleRef.of('sale_1'), amount: Money.of(1999, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
    expect(out.clientHandle.value).toBe('cs_1');
    expect(d.provider.createIntent).toHaveBeenCalledOnce();
    expect(d.saved[0].status).toBe('REQUIRES_PAYMENT');
  });

  it('reuses the existing in-flight intent for the same SaleRef (idempotent)', async () => {
    const d = makeDeps();
    d.repo.findBySaleRef = vi.fn(async () => ({ id: 'int_existing', status: 'REQUIRES_PAYMENT', providerRef: { provider: 'STRIPE', providerIntentId: 'pi_existing' } })) as any;
    const svc = new CreatePaymentIntentService({
      providerFor: async () => d.provider as any,
      intentRepo: d.repo as any,
      tenantConfig: d.config as any,
      events: d.events as any,
      newIntentId: d.idGen,
    });
    const out = await svc.create({ saleRef: SaleRef.of('sale_1'), amount: Money.of(1999, 'USD'), captureMethod: CaptureMethod.AUTOMATIC });
    expect(out.intentId).toBe('int_existing');
    expect(d.provider.createIntent).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount', async () => {
    const d = makeDeps();
    const svc = new CreatePaymentIntentService({ providerFor: async () => d.provider as any, intentRepo: d.repo as any, tenantConfig: d.config as any, events: d.events as any, newIntentId: d.idGen });
    await expect(svc.create({ saleRef: SaleRef.of('s'), amount: Money.of(0, 'USD'), captureMethod: CaptureMethod.AUTOMATIC })).rejects.toThrow();
  });

  it('marks redirect intents PROCESSING and forwards the request context', async () => {
    const d = makeDeps();
    d.provider.createIntent = vi.fn(async () => ({ providerRef: { provider: 'ACME', providerIntentId: 'sale_1' }, clientHandle: { provider: 'ACME', kind: 'redirect_url' as const, value: 'https://pay/x' } })) as never;
    d.config.configuredProviders = vi.fn(async () => ['ACME']) as never;
    const svc = new CreatePaymentIntentService({ providerFor: async () => d.provider as any, intentRepo: d.repo as any, tenantConfig: d.config as any, events: d.events as any, newIntentId: d.idGen });
    const context = { buyer: { email: 'a@b.c' }, lines: [] };
    const out = await svc.create({ saleRef: SaleRef.of('sale_1'), amount: Money.of(100, 'USD'), captureMethod: CaptureMethod.AUTOMATIC, provider: 'ACME', context });
    expect(out.clientHandle.kind).toBe('redirect_url');
    expect(d.saved[0].status).toBe('PROCESSING');
    expect((d.provider.createIntent as any).mock.calls[0][0].context).toBe(context);
  });
  it('logs the currency code and rethrows when the provider rejects intent creation', async () => {
    const d = makeDeps();
    d.provider.createIntent = vi.fn(async () => { throw new Error('Currency JPY is not supported'); }) as never;
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const svc = new CreatePaymentIntentService({ providerFor: async () => d.provider as any, intentRepo: d.repo as any, tenantConfig: d.config as any, events: d.events as any, newIntentId: d.idGen });
    await expect(svc.create({ saleRef: SaleRef.of('sale_9'), amount: Money.of(1000, 'JPY'), captureMethod: CaptureMethod.AUTOMATIC })).rejects.toThrow('Currency JPY is not supported');
    const logged = spy.mock.calls.map((c) => String(c[0])).find((line) => line.includes('Payment intent creation failed'));
    spy.mockRestore();
    expect(logged).toBeDefined();
    expect(JSON.parse(logged!).currencyCode).toBe('JPY');
    expect(d.saved).toHaveLength(0);
  });
});
