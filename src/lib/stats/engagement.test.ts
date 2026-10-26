import { describe, it, expect } from 'vitest';
import {
  DEEP_PCT,
  DEPTH_BANDS,
  bandForPct,
  bandLabel,
  biggestExit,
  classifyVisit,
  deepThresholdPct,
  formatDuration,
  quadrantShares,
  screensTall,
  type BandRow,
} from './engagement';

describe('deepThresholdPct', () => {
  it('scales the threshold to two screens of the page', () => {
    // 5% per screen -> a 20-screen page -> deep at 10%
    expect(deepThresholdPct(5)).toBe(10);
  });

  it('clamps to 100 on a page no taller than the viewport', () => {
    // A one-screen page is fully seen on arrival, so everyone there is deep.
    expect(deepThresholdPct(100)).toBe(100);
    expect(deepThresholdPct(60)).toBe(100);
  });

  it('falls back to a fixed half for visits that reported no viewport share', () => {
    expect(deepThresholdPct(null)).toBe(DEEP_PCT);
    expect(deepThresholdPct(undefined)).toBe(DEEP_PCT);
    expect(deepThresholdPct(0)).toBe(DEEP_PCT);
    expect(deepThresholdPct(Number.NaN)).toBe(DEEP_PCT);
  });
});

describe('screensTall', () => {
  it('inverts the viewport share', () => {
    expect(screensTall(5)).toBe(20);
  });

  it('is null when unmeasured', () => {
    expect(screensTall(null)).toBeNull();
    expect(screensTall(0)).toBeNull();
  });
});

describe('classifyVisit', () => {
  it('is ENGAGED when past two screens and past ten seconds', () => {
    expect(classifyVisit({ dwellMs: 20_000, maxScrollPct: 40, viewportPct: 5 })).toBe('ENGAGED');
  });

  it('is SKIMMED when deep but brief', () => {
    expect(classifyVisit({ dwellMs: 3_000, maxScrollPct: 40, viewportPct: 5 })).toBe('SKIMMED');
  });

  it('is STALLED when long but shallow', () => {
    expect(classifyVisit({ dwellMs: 60_000, maxScrollPct: 4, viewportPct: 5 })).toBe('STALLED');
  });

  it('is BOUNCED when shallow and brief', () => {
    expect(classifyVisit({ dwellMs: 2_000, maxScrollPct: 4, viewportPct: 5 })).toBe('BOUNCED');
  });

  it('counts a missing depth as shallow rather than dropping the visit', () => {
    // Non-reporting skews toward the visitors who left fastest; dropping them
    // would empty out BOUNCED specifically.
    expect(classifyVisit({ dwellMs: 1_000, maxScrollPct: null })).toBe('BOUNCED');
  });

  it('prefers foreground time over wall clock', () => {
    // A tab parked in the background clears ten seconds on its own; counting it
    // would fill STALLED with visitors who were never present.
    expect(classifyVisit({ dwellMs: 600_000, activeMs: 1_200, maxScrollPct: 4, viewportPct: 5 }))
      .toBe('BOUNCED');
  });

  it('treats exactly the threshold as deep and long', () => {
    expect(classifyVisit({ dwellMs: 10_000, maxScrollPct: 10, viewportPct: 5 })).toBe('ENGAGED');
  });
});

describe('quadrantShares', () => {
  it('returns percentages that sum to 100', () => {
    const shares = quadrantShares({ BOUNCED: 1, SKIMMED: 1, STALLED: 1, ENGAGED: 1 }, 4);
    expect(shares).not.toBeNull();
    const total = Object.values(shares!).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100);
  });

  it('is null at zero traffic, not four zeros', () => {
    // Four zeros draw a bar indistinguishable from a page where everyone bounced.
    expect(quadrantShares({ BOUNCED: 0, SKIMMED: 0, STALLED: 0, ENGAGED: 0 }, 0)).toBeNull();
  });
});

function band(index: number, exits: number): BandRow {
  return { index, label: bandLabel(index), reached: 0, medianVisibleMs: null, exits, interactions: 0 };
}

describe('biggestExit', () => {
  it('names the band that lost the most visitors', () => {
    expect(biggestExit([band(0, 2), band(1, 50)], 100)?.index).toBe(1);
  });

  it('names nothing when no band clears the floor', () => {
    // Every band losing a similar sliver is not a finding.
    expect(biggestExit([band(0, 10), band(1, 12), band(2, 11)], 100)).toBeNull();
  });

  it('names nothing at zero traffic', () => {
    expect(biggestExit([band(0, 0)], 0)).toBeNull();
  });
});

describe('bandForPct', () => {
  it('puts the bottom of the page in the last band', () => {
    // Off-by-one here silently drops everyone who read to the end.
    expect(bandForPct(100)).toBe(DEPTH_BANDS - 1);
  });

  it('clamps out-of-range and unusable input into range', () => {
    expect(bandForPct(-5)).toBe(0);
    expect(bandForPct(1000)).toBe(DEPTH_BANDS - 1);
    expect(bandForPct(Number.NaN)).toBe(0);
  });

  it('labels a band by its own slice', () => {
    expect(bandLabel(8)).toBe('40-45%');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and the unmeasured case', () => {
    expect(formatDuration(8_000)).toBe('8s');
    expect(formatDuration(80_000)).toBe('1m 20s');
    expect(formatDuration(120_000)).toBe('2m');
    expect(formatDuration(null)).toBe('-');
    expect(formatDuration(-1)).toBe('-');
  });
});
