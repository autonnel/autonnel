import { describe, it, expect } from 'vitest';
import { CaptureResultReconciler, CaptureSource } from '../capture-result-reconciler';
import { ProviderSelectionPolicy } from '../provider-selection-policy';
import { CaptureResult } from '../value-objects';
import { Money } from '../../../shared-kernel/money';

const result = (charge: string) =>
  CaptureResult.of({ providerChargeId: charge, capturedAmount: Money.of(1999, 'USD'), capturedAt: new Date() });

describe('CaptureResultReconciler', () => {
  const r = new CaptureResultReconciler();

  it('records a webhook capture as authoritative', () => {
    const out = r.reconcile({ existing: undefined, incoming: result('ch_1'), source: CaptureSource.WEBHOOK });
    expect(out.shouldApply).toBe(true);
    expect(out.authoritative).toBe(true);
  });

  it('treats a sync-response capture as advisory: applies only if no authoritative result yet', () => {
    const out = r.reconcile({ existing: undefined, incoming: result('ch_1'), source: CaptureSource.SYNC });
    expect(out.shouldApply).toBe(true);
    expect(out.authoritative).toBe(false);
  });

  it('a replayed webhook for the same providerChargeId is a no-op', () => {
    const out = r.reconcile({ existing: result('ch_1'), incoming: result('ch_1'), source: CaptureSource.WEBHOOK });
    expect(out.shouldApply).toBe(false);
  });
});

describe('ProviderSelectionPolicy', () => {
  it('selects the provider slug requested by the caller when configured', () => {
    const policy = new ProviderSelectionPolicy();
    expect(policy.select('STRIPE', ['STRIPE', 'PAYPAL'])).toBe('STRIPE');
  });
  it('throws when the requested provider is not configured', () => {
    const policy = new ProviderSelectionPolicy();
    expect(() => policy.select('PAYPAL', ['STRIPE'])).toThrow('not configured');
  });
});
