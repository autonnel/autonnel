import { describe, it, expect } from 'vitest';
import { StepSlug, FunnelSnapshotRef } from './funnel-snapshot-ref';

describe('StepSlug', () => {
  it('accepts a valid lowercase slug', () => {
    expect(StepSlug.of('checkout').value).toBe('checkout');
    expect(StepSlug.of('upsell-1').value).toBe('upsell-1');
    expect(StepSlug.of('  step-2  ').value).toBe('step-2');
  });

  it('rejects an invalid slug', () => {
    expect(() => StepSlug.of('Checkout')).toThrow(/Invalid StepSlug/);
    expect(() => StepSlug.of('-leading')).toThrow(/Invalid StepSlug/);
    expect(() => StepSlug.of('has space')).toThrow(/Invalid StepSlug/);
  });
});

describe('FunnelSnapshotRef', () => {
  it('creates a ref with a positive version', () => {
    const r = FunnelSnapshotRef.of('fnl_1', 2);
    expect(r.funnelId).toBe('fnl_1');
    expect(r.version).toBe(2);
  });

  it('rejects a missing funnelId', () => {
    expect(() => FunnelSnapshotRef.of('', 1)).toThrow(/funnelId/);
  });

  it('rejects a non-positive version', () => {
    expect(() => FunnelSnapshotRef.of('fnl_1', 0)).toThrow(/version/);
    expect(() => FunnelSnapshotRef.of('fnl_1', 1.5)).toThrow(/version/);
  });

  it('compares by funnelId and version', () => {
    const a = FunnelSnapshotRef.of('fnl_1', 2);
    expect(a.equals(FunnelSnapshotRef.of('fnl_1', 2))).toBe(true);
    expect(a.equals(FunnelSnapshotRef.of('fnl_1', 3))).toBe(false);
    expect(a.equals(FunnelSnapshotRef.of('fnl_2', 2))).toBe(false);
  });
});
