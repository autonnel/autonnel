// Depth is a position and time is a duration; neither alone says whether a
// visitor was interested. Crossing them produces four groups, of which STALLED
// (present but never past the fold) is invisible in any depth-only view.

export const DEEP_SCREENS = 2;
/** Fallback threshold for visits whose beacon reported no viewport share. */
export const DEEP_PCT = 50;
export const LONG_MS = 10_000;
export const DEPTH_BANDS = 20;
export const EXIT_SHARE_FLOOR = 0.15;

// A fixed percentage cannot mean one thing across pages: production pages run
// from one screen tall to fifty, so "half the page" is arrival on one and
// twenty-five screens of reading on another. Scaling by screens fixes the
// meaning instead of the number.
export function deepThresholdPct(viewportPct: number | null | undefined): number {
  if (viewportPct === null || viewportPct === undefined) return DEEP_PCT;
  if (!Number.isFinite(viewportPct) || viewportPct <= 0) return DEEP_PCT;
  return Math.min(100, Math.round(viewportPct * DEEP_SCREENS));
}

export function screensTall(viewportPct: number | null | undefined): number | null {
  if (viewportPct === null || viewportPct === undefined) return null;
  if (!Number.isFinite(viewportPct) || viewportPct <= 0) return null;
  return 100 / viewportPct;
}

export function bandStartPct(i: number): number {
  return Math.round((i * 100) / DEPTH_BANDS);
}

export function bandEndPct(i: number): number {
  return Math.round(((i + 1) * 100) / DEPTH_BANDS);
}

export function bandLabel(i: number): string {
  return `${bandStartPct(i)}-${bandEndPct(i)}%`;
}

// 100% belongs to the last band rather than a nonexistent band 20: the bottom
// of the page is a place visitors reach.
export function bandForPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  const i = Math.floor((pct / 100) * DEPTH_BANDS);
  if (i < 0) return 0;
  if (i >= DEPTH_BANDS) return DEPTH_BANDS - 1;
  return i;
}

export function emptyBands(): number[] {
  return new Array(DEPTH_BANDS).fill(0);
}

export type Quadrant = 'BOUNCED' | 'SKIMMED' | 'STALLED' | 'ENGAGED';

export const QUADRANTS: Quadrant[] = ['BOUNCED', 'SKIMMED', 'STALLED', 'ENGAGED'];

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  BOUNCED: 'Bounced',
  SKIMMED: 'Skimmed',
  STALLED: 'Stalled',
  ENGAGED: 'Engaged',
};

export const QUADRANT_HINT: Record<Quadrant, string> = {
  BOUNCED: 'Never got past the first screens, and left quickly. What is above the fold is the problem.',
  SKIMMED: 'Travelled the page without stopping, usually hunting for a price or a button.',
  STALLED: 'Stayed a while and still never got past the first screens, so something there held them up.',
  ENGAGED: 'Got past the first screens and read.',
};

export interface QuadrantCounts {
  BOUNCED: number;
  SKIMMED: number;
  STALLED: number;
  ENGAGED: number;
}

export interface ClassifiableVisit {
  /** Wall-clock milliseconds on the page, including the load. */
  dwellMs: number;
  /** Foreground-only milliseconds, when the beacon reported them. */
  activeMs?: number | null;
  maxScrollPct: number | null;
  /** Share of the document one screen covers, 1-100. */
  viewportPct?: number | null;
}

// Missing depth counts as shallow rather than being dropped: non-reporting
// skews toward the visitors who left fastest, so excluding them would empty out
// BOUNCED, the group that most needs to be visible.
export function classifyVisit(visit: ClassifiableVisit): Quadrant {
  const deep = (visit.maxScrollPct ?? 0) >= deepThresholdPct(visit.viewportPct);
  const long = (visit.activeMs ?? visit.dwellMs) >= LONG_MS;
  if (deep && long) return 'ENGAGED';
  if (deep) return 'SKIMMED';
  if (long) return 'STALLED';
  return 'BOUNCED';
}

export function quadrantShares(counts: QuadrantCounts, uv: number): Record<Quadrant, number> | null {
  if (!Number.isFinite(uv) || uv <= 0) return null;
  return {
    BOUNCED: (counts.BOUNCED / uv) * 100,
    SKIMMED: (counts.SKIMMED / uv) * 100,
    STALLED: (counts.STALLED / uv) * 100,
    ENGAGED: (counts.ENGAGED / uv) * 100,
  };
}

export interface BandRow {
  index: number;
  label: string;
  /** Visitors for whom this band was on screen at all. */
  reached: number;
  medianVisibleMs: number | null;
  /** Visitors whose deepest point fell inside this band. */
  exits: number;
  interactions: number;
}

// Measured by where visitors stopped, not by the fall in reach between
// neighbours: reach also falls because people scrolled straight past, and only
// stopping is a finding. The floor keeps the badge off pages where every band
// loses a similar sliver.
export function biggestExit(bands: BandRow[], uv: number): BandRow | null {
  if (uv <= 0) return null;
  let best: BandRow | null = null;
  for (const b of bands) {
    if (!best || b.exits > best.exits) best = b;
  }
  if (!best || best.exits / uv < EXIT_SHARE_FLOOR) return null;
  return best;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '-';
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec === 0 ? `${min}m` : `${min}m ${sec}s`;
}
