import { describe, it, expect } from 'vitest';
import { FunnelReachabilityService } from './funnel-reachability-service';

const sut = new FunnelReachabilityService();

describe('FunnelReachabilityService', () => {
  it('reports all steps reachable from the entry', () => {
    const r = sut.analyze({
      entryStepSlug: 'lp',
      steps: ['lp', 'checkout', 'thankyou'],
      transitions: [
        { fromStepSlug: 'lp', toStepSlug: 'checkout' },
        { fromStepSlug: 'checkout', toStepSlug: 'thankyou' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.unreachable).toEqual([]);
  });

  it('flags an unreachable step', () => {
    const r = sut.analyze({
      entryStepSlug: 'lp',
      steps: ['lp', 'checkout', 'orphan'],
      transitions: [{ fromStepSlug: 'lp', toStepSlug: 'checkout' }],
    });
    expect(r.ok).toBe(false);
    expect(r.unreachable).toContain('orphan');
  });

  it('fails when the entry step is not among steps', () => {
    const r = sut.analyze({ entryStepSlug: 'missing', steps: ['lp'], transitions: [] });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /entry/i.test(i))).toBe(true);
  });

  it('fails when a transition references a non-existent step', () => {
    const r = sut.analyze({
      entryStepSlug: 'lp',
      steps: ['lp'],
      transitions: [{ fromStepSlug: 'lp', toStepSlug: 'ghost' }],
    });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /unknown step/i.test(i))).toBe(true);
  });
});
