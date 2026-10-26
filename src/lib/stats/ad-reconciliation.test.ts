import { describe, it, expect } from 'vitest';
import { computeDiff, detectConflictReasons, STATIC_CONFLICT_NOTES } from './ad-reconciliation';

describe('computeDiff', () => {
  it('is OK when the relative gap is within 15%', () => {
    expect(computeDiff({ metric: 'clicks', platform: 1000, onsite: 900 })).toEqual({
      diff: 100,
      diffPct: 0.1,
      severity: 'OK',
    });
  });

  it('warns between 15% and 40%', () => {
    expect(computeDiff({ metric: 'clicks', platform: 1000, onsite: 700 }).severity).toBe('WARN');
  });

  it('alerts beyond 40%', () => {
    expect(computeDiff({ metric: 'clicks', platform: 1000, onsite: 400 }).severity).toBe('ALERT');
  });

  it('stays OK when the absolute gap is below the metric floor, however large the percentage', () => {
    // 1 order out of 2 is 50% but is never worth a red cell.
    expect(computeDiff({ metric: 'conversions', platform: 2, onsite: 1 }).severity).toBe('OK');
  });

  it('flags PLATFORM_ZERO when the platform reports nothing but we recorded something', () => {
    expect(computeDiff({ metric: 'conversions', platform: 0, onsite: 12 })).toEqual({
      diff: -12,
      diffPct: null,
      severity: 'PLATFORM_ZERO',
    });
  });

  it('is OK when both sides are zero', () => {
    expect(computeDiff({ metric: 'conversions', platform: 0, onsite: 0 }).severity).toBe('OK');
  });

  it('handles the onsite side being larger', () => {
    const r = computeDiff({ metric: 'clicks', platform: 100, onsite: 300 });
    expect(r.diff).toBe(-200);
    expect(r.severity).toBe('ALERT');
  });
});

describe('detectConflictReasons', () => {
  const base = {
    accountTimezone: 'America/Los_Angeles',
    siteTimezone: 'America/Los_Angeles',
    failedPostbacks: 0,
    connectionExpired: false,
    ambiguousCreatives: 0,
    platformConversions: 10,
  };

  it('returns nothing when everything lines up', () => {
    expect(detectConflictReasons(base)).toEqual([]);
  });

  it('reports a timezone mismatch with both zones in the detail', () => {
    const reasons = detectConflictReasons({ ...base, accountTimezone: 'Asia/Shanghai' });
    expect(reasons).toHaveLength(1);
    expect(reasons[0].code).toBe('TIMEZONE_MISMATCH');
    expect(reasons[0].detail).toContain('Asia/Shanghai');
    expect(reasons[0].detail).toContain('America/Los_Angeles');
  });

  it('reports failed postbacks with the count, because that is a real bug not a methodology gap', () => {
    const reasons = detectConflictReasons({ ...base, failedPostbacks: 7 });
    expect(reasons.map((r) => r.code)).toEqual(['FAILED_POSTBACKS']);
    expect(reasons[0].detail).toContain('7');
  });

  it('reports an expired connection', () => {
    expect(detectConflictReasons({ ...base, connectionExpired: true }).map((r) => r.code)).toEqual([
      'CONNECTION_EXPIRED',
    ]);
  });

  it('reports unassigned creatives', () => {
    expect(detectConflictReasons({ ...base, ambiguousCreatives: 3 }).map((r) => r.code)).toEqual([
      'UNASSIGNED_CREATIVES',
    ]);
  });

  it('reports modeled conversions when the platform count is fractional', () => {
    expect(detectConflictReasons({ ...base, platformConversions: 10.4 }).map((r) => r.code)).toEqual([
      'MODELED_CONVERSIONS',
    ]);
  });

  it('reports every hit at once', () => {
    const reasons = detectConflictReasons({
      accountTimezone: 'Asia/Shanghai',
      siteTimezone: 'UTC',
      failedPostbacks: 2,
      connectionExpired: true,
      ambiguousCreatives: 1,
      platformConversions: 3.5,
    });
    expect(reasons.map((r) => r.code)).toEqual([
      'TIMEZONE_MISMATCH',
      'FAILED_POSTBACKS',
      'CONNECTION_EXPIRED',
      'UNASSIGNED_CREATIVES',
      'MODELED_CONVERSIONS',
    ]);
  });
});

describe('STATIC_CONFLICT_NOTES', () => {
  it('always ships the methodology notes', () => {
    expect(STATIC_CONFLICT_NOTES.length).toBeGreaterThan(0);
  });
});
