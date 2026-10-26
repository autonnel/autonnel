import { describe, it, expect, vi } from 'vitest';
import { CompleteRedirectPaymentService } from '../complete-redirect-payment.service';
import { PaymentIntent } from '../../domain/payment-intent';
import { SaleRef, CaptureMethod, ProviderRef } from '../../domain/value-objects';
import { Money } from '../../../shared-kernel/money';

function intent(status = 'PROCESSING') {
  return PaymentIntent.rehydrate({
    id: 'i1', saleRef: SaleRef.of('s1'), provider: 'ACME', amount: Money.of(9037, 'EUR'), captureMethod: CaptureMethod.AUTOMATIC,
    status: status as never, providerRef: ProviderRef.of('ACME', 's1'), refundRecords: [],
  });
}
const capture = { providerChargeId: 'TR1', capturedAmountMinor: 9037, currencyCode: 'EUR', capturedAt: '2026-10-13T00:00:00Z', vaultRef: 'agr_1' };

function deps(over: Partial<Record<string, unknown>> = {}, beforePublish?: (i: unknown) => Promise<void>) {
  const repo = {
    findBySaleRef: vi.fn(async () => intent()), findByProviderRef: vi.fn(async () => intent()),
    claimCapture: vi.fn(async () => true), releaseCapture: vi.fn(async () => {}), save: vi.fn(async () => {}), setVaultRef: vi.fn(async () => {}),
  };
  const provider = { getIntent: vi.fn(async () => ({ status: 'CAPTURED', capture })) };
  const events = { publish: vi.fn(async () => {}) };
  return { repo, provider, events, svc: new CompleteRedirectPaymentService({ providerFor: async () => provider as never, intentRepo: { ...repo, ...over } as never, events: events as never, beforePublish: beforePublish as never }) };
}

describe('CompleteRedirectPaymentService', () => {
  it('captures from a status query using the intent amount as hint', async () => {
    const d = deps();
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('captured');
    expect(d.provider.getIntent).toHaveBeenCalledWith('s1', { amountMinor: 9037, currencyCode: 'EUR' });
    expect(d.events.publish).toHaveBeenCalledOnce();
  });

  it('concurrent completion publishes once', async () => {
    const d = deps();
    d.repo.claimCapture.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    d.repo.findBySaleRef.mockResolvedValueOnce(intent()).mockResolvedValueOnce(intent('CAPTURED'));
    await Promise.all([d.svc.finalizeBySaleRef('s1'), d.svc.applyWebhook('ACME', { provider: 'ACME', providerEventId: 'e', type: 'payment', providerIntentId: 's1', status: 'CAPTURED', capture })]);
    expect(d.events.publish).toHaveBeenCalledOnce();
    expect(d.repo.setVaultRef).toHaveBeenCalledWith('i1', 'agr_1');
  });

  it('failed signal does not terminate the intent', async () => {
    const d = deps();
    expect(await d.svc.applyWebhook('ACME', { provider: 'ACME', providerEventId: 'e1', type: 'payment', providerIntentId: 's1', status: 'FAILED' })).toBe('ignored');
    expect(d.repo.save).not.toHaveBeenCalled();
    expect(await d.svc.applyWebhook('ACME', { provider: 'ACME', providerEventId: 'e2', type: 'payment', providerIntentId: 's1', status: 'CAPTURED', capture })).toBe('captured');
  });

  it('reports failed and pending without changing state', async () => {
    const d = deps();
    d.provider.getIntent.mockResolvedValueOnce({ status: 'FAILED' } as never).mockResolvedValueOnce({ status: 'PENDING' } as never);
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('failed');
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('pending');
    expect(d.repo.claimCapture).not.toHaveBeenCalled();
  });

  it('ignores notifications for unknown intents (e.g. MIT or refund requests)', async () => {
    const d = deps();
    d.repo.findByProviderRef.mockResolvedValueOnce(null as never);
    expect(await d.svc.applyWebhook('ACME', { provider: 'ACME', providerEventId: 'e', type: 'payment', providerIntentId: 'upsell_x', status: 'CAPTURED', capture })).toBe('ignored');
  });

  it('releases the claim and rethrows when persisting the capture fails', async () => {
    const d = deps();
    d.repo.save.mockRejectedValueOnce(new Error('db down'));
    await expect(d.svc.finalizeBySaleRef('s1')).rejects.toThrow('db down');
    expect(d.repo.releaseCapture).toHaveBeenCalledWith('i1');
    expect(d.events.publish).not.toHaveBeenCalled();
  });

  it('does not release when publishing fails after a successful save', async () => {
    const d = deps();
    d.events.publish.mockRejectedValueOnce(new Error('bus'));
    await expect(d.svc.finalizeBySaleRef('s1')).rejects.toThrow('bus');
    expect(d.repo.releaseCapture).not.toHaveBeenCalled();
  });

  it('ignores a captured notification for a canceled intent', async () => {
    const d = deps();
    d.repo.findByProviderRef.mockResolvedValueOnce(intent('CANCELED') as never);
    d.repo.claimCapture.mockResolvedValueOnce(false);
    expect(await d.svc.applyWebhook('ACME', { provider: 'ACME', providerEventId: 'e', type: 'payment', providerIntentId: 's1', status: 'CAPTURED', capture })).toBe('ignored');
    expect(d.events.publish).not.toHaveBeenCalled();
  });

  it('releases the claim, logs and rethrows the original error when release also fails', async () => {
    const d = deps();
    d.repo.save.mockRejectedValueOnce(new Error('db down'));
    d.repo.releaseCapture.mockRejectedValueOnce(new Error('release failed'));
    await expect(d.svc.finalizeBySaleRef('s1')).rejects.toThrow('db down');
  });

  it('runs beforePublish once for the winner, after save and before publish', async () => {
    const order: string[] = [];
    const before = vi.fn(async () => { order.push('before'); });
    const d = deps({}, before);
    d.repo.save.mockImplementationOnce(async () => { order.push('save'); });
    d.events.publish.mockImplementationOnce(async () => { order.push('publish'); });
    await d.svc.finalizeBySaleRef('s1');
    expect(before).toHaveBeenCalledOnce();
    expect(order).toEqual(['save', 'before', 'publish']);
  });

  it('never runs beforePublish for the claim loser', async () => {
    const before = vi.fn(async () => {});
    const d = deps({}, before);
    d.repo.claimCapture.mockResolvedValueOnce(false);
    d.repo.findBySaleRef.mockResolvedValueOnce(intent()).mockResolvedValueOnce(intent('CAPTURED'));
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('captured');
    expect(before).not.toHaveBeenCalled();
    expect(d.events.publish).not.toHaveBeenCalled();
  });

  it('reports failed when the claim is lost on a non-capturable intent', async () => {
    const d = deps();
    d.repo.claimCapture.mockResolvedValueOnce(false);
    d.repo.findBySaleRef.mockResolvedValueOnce(intent()).mockResolvedValueOnce(intent('CANCELED'));
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('failed');
    expect(d.events.publish).not.toHaveBeenCalled();
  });

  it('does not capture when the captured amount differs from the intent', async () => {
    const d = deps();
    d.provider.getIntent.mockResolvedValueOnce({ status: 'CAPTURED', capture: { ...capture, capturedAmountMinor: 100 } } as never);
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('pending');
    expect(d.repo.claimCapture).not.toHaveBeenCalled();
    expect(d.events.publish).not.toHaveBeenCalled();
  });

  it('does not capture when the currency differs, but compares it case-insensitively', async () => {
    const d = deps();
    d.provider.getIntent.mockResolvedValueOnce({ status: 'CAPTURED', capture: { ...capture, currencyCode: 'USD' } } as never);
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('pending');
    d.provider.getIntent.mockResolvedValueOnce({ status: 'CAPTURED', capture: { ...capture, currencyCode: 'eur' } } as never);
    expect(await d.svc.finalizeBySaleRef('s1')).toBe('captured');
  });

  it('ignores a mismatched notification', async () => {
    const d = deps();
    const parsed = { provider: 'ACME', providerEventId: 'e', type: 'payment', providerIntentId: 's1', status: 'CAPTURED', capture: { ...capture, capturedAmountMinor: 1 } } as never;
    expect(await d.svc.applyWebhook('ACME', parsed)).toBe('ignored');
    expect(d.repo.claimCapture).not.toHaveBeenCalled();
  });
});
