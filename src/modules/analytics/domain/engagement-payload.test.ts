import { describe, it, expect } from 'vitest';
import { DEPTH_BANDS } from '@/lib/stats/engagement';
import {
  MAX_DURATION_MS,
  parseDurationMs,
  parseDwellByDepth,
  parseEngagementPayload,
  parseInteractions,
  parseScrollPct,
} from './engagement-payload';

function bands(fill = 1): number[] {
  return new Array(DEPTH_BANDS).fill(fill);
}

describe('parseDurationMs', () => {
  it('accepts whole non-negative milliseconds', () => {
    expect(parseDurationMs(1_500)).toBe(1_500);
    expect(parseDurationMs(0)).toBe(0);
    expect(parseDurationMs(1_500.6)).toBe(1_501);
  });

  it('rejects non-numbers rather than coercing them', () => {
    // In JS `true`, `[]` and `{}` all convert to numbers. One accepted `true`
    // becomes a 1 that nothing downstream can tell from a measurement.
    expect(parseDurationMs(true)).toBeNull();
    expect(parseDurationMs([])).toBeNull();
    expect(parseDurationMs({})).toBeNull();
    expect(parseDurationMs('1500')).toBeNull();
    expect(parseDurationMs(Number.NaN)).toBeNull();
    expect(parseDurationMs(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('rejects negatives and anything past the twelve hour ceiling', () => {
    expect(parseDurationMs(-1)).toBeNull();
    expect(parseDurationMs(MAX_DURATION_MS + 1)).toBeNull();
    expect(parseDurationMs(MAX_DURATION_MS)).toBe(MAX_DURATION_MS);
  });
});

describe('parseScrollPct', () => {
  it('accepts whole percentages in range', () => {
    expect(parseScrollPct(0)).toBe(0);
    expect(parseScrollPct(100)).toBe(100);
    expect(parseScrollPct(45.4)).toBe(45);
  });

  it('rejects out-of-range values and non-numbers', () => {
    expect(parseScrollPct(-1)).toBeNull();
    expect(parseScrollPct(101)).toBeNull();
    expect(parseScrollPct(true)).toBeNull();
    expect(parseScrollPct('50')).toBeNull();
  });
});

describe('parseDwellByDepth', () => {
  it('accepts an array of exactly the band count', () => {
    expect(parseDwellByDepth(bands())).toEqual(bands());
  });

  it('rejects a wrong-length array outright instead of padding it', () => {
    // The index IS the position on the page. Padding invents attention at the
    // bottom of a page nobody reached; trimming slides every later band up.
    expect(parseDwellByDepth(bands().slice(1))).toBeNull();
    expect(parseDwellByDepth([...bands(), 1])).toBeNull();
  });

  it('rejects the whole array when any single entry is unusable', () => {
    const withBadEntry = bands();
    withBadEntry[7] = -1;
    expect(parseDwellByDepth(withBadEntry)).toBeNull();

    const withCoercible = bands() as unknown[];
    withCoercible[7] = true;
    expect(parseDwellByDepth(withCoercible)).toBeNull();
  });

  it('rejects an all-zero array as not a measurement', () => {
    // Storing it adds a row to every band's denominator and to no numerator.
    expect(parseDwellByDepth(bands(0))).toBeNull();
  });

  it('rejects non-arrays', () => {
    expect(parseDwellByDepth(null)).toBeNull();
    expect(parseDwellByDepth({})).toBeNull();
  });
});

describe('parseInteractions', () => {
  it('keeps well-formed band:kind pairs and deduplicates them', () => {
    expect(parseInteractions(['3:cta', '3:cta', '5:video'])).toEqual(['3:cta', '5:video']);
  });

  it('drops individual bad entries rather than failing the list', () => {
    // Unlike the dwell array these carry no meaning by index, so one bad entry
    // cannot slide the others onto the wrong band.
    expect(parseInteractions(['3:cta', 'nope', '99:cta', '3:hack', 7, '3:'])).toEqual(['3:cta']);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 300 }, (_, i) => `${i % DEPTH_BANDS}:cta`);
    expect(parseInteractions(many).length).toBeLessThanOrEqual(100);
  });

  it('is empty for non-arrays', () => {
    expect(parseInteractions(null)).toEqual([]);
    expect(parseInteractions('3:cta')).toEqual([]);
  });

  it('canonicalizes band:kind pairs to reject spelling variants', () => {
    // Whitespace and numeric notation variants must map to the same canonical
    // form to prevent dedup evasion and ensure stored strings are readable.
    expect(parseInteractions(['3:cta', ' 3:cta', '+3:cta', '1e1:cta'])).toEqual(['3:cta', '10:cta']);
  });

  it('does not alter an already-canonical list', () => {
    // Normalization is a no-op on correct input.
    expect(parseInteractions(['3:cta', '5:video', '7:expand'])).toEqual(['3:cta', '5:video', '7:expand']);
  });
});

describe('parseEngagementPayload', () => {
  const valid = {
    timeOnPageMs: 30_000,
    engagement: {
      activeMs: 12_000,
      maxScrollPct: 60,
      exitScrollPct: 55,
      viewportPct: 5,
      dwellByDepth: bands(),
      interactions: ['3:cta'],
    },
  };

  it('reads a complete payload', () => {
    expect(parseEngagementPayload(valid)).toEqual({
      dwellMs: 30_000,
      activeMs: 12_000,
      maxScrollPct: 60,
      exitScrollPct: 55,
      viewportPct: 5,
      dwellByDepth: bands(),
      interactions: ['3:cta'],
    });
  });

  it('is null without a usable dwell', () => {
    // A row of nulls still counts toward every panel's denominator.
    expect(parseEngagementPayload({ ...valid, timeOnPageMs: undefined })).toBeNull();
    expect(parseEngagementPayload(null)).toBeNull();
  });

  it('survives a payload carrying no engagement half at all', () => {
    const out = parseEngagementPayload({ timeOnPageMs: 4_000 });
    expect(out).toEqual({
      dwellMs: 4_000,
      activeMs: null,
      maxScrollPct: null,
      exitScrollPct: null,
      viewportPct: null,
      dwellByDepth: [],
      interactions: [],
    });
  });

  it('never lets foreground time exceed wall clock', () => {
    // A client reporting more foreground than elapsed is broken or forged, and
    // the pair is only useful while activeMs <= dwellMs holds.
    const out = parseEngagementPayload({ ...valid, engagement: { ...valid.engagement, activeMs: 99_000 } });
    expect(out?.activeMs).toBe(30_000);
  });

  it('rejects a zero viewport share', () => {
    // A screen covering none of the document would collapse the depth threshold
    // to zero and mark every visit deep.
    const out = parseEngagementPayload({ ...valid, engagement: { ...valid.engagement, viewportPct: 0 } });
    expect(out?.viewportPct).toBeNull();
  });
});

import { METADATA_MAX_BYTES, METADATA_MAX_DEPTH } from './activity-event';

describe('engagement payload budget', () => {
  it('a worst-case payload stays inside the activity metadata budget', () => {
    const worst = {
      timeOnPageMs: MAX_DURATION_MS,
      engagement: {
        activeMs: MAX_DURATION_MS,
        maxScrollPct: 100,
        exitScrollPct: 100,
        viewportPct: 100,
        dwellByDepth: new Array(DEPTH_BANDS).fill(MAX_DURATION_MS),
        interactions: Array.from({ length: 100 }, (_, i) => `${i % DEPTH_BANDS}:expand`),
      },
    };
    expect(JSON.stringify(worst).length).toBeLessThan(METADATA_MAX_BYTES);
    // metadata -> engagement -> dwellByDepth -> entries
    expect(METADATA_MAX_DEPTH).toBeGreaterThanOrEqual(4);
  });
});
