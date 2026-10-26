import { DEPTH_BANDS } from '@/lib/stats/engagement';
import { createLogger } from '@/lib/logger';

const logger = createLogger('analytics:engagement-payload');

// A tab left open for days would dominate a median on its own. The client
// pauses accrual on visibilitychange, so this is the backstop for a payload
// that never ran that code.
export const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
export const MAX_INTERACTIONS = 100;
export const INTERACTION_KINDS = new Set(['cta', 'expand', 'video']);

export function parseDurationMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0 || n > MAX_DURATION_MS) return null;
  return n;
}

export function parseScrollPct(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 0 || n > 100) return null;
  return n;
}

// All-or-nothing: the index IS the position on the page, so dropping one bad
// entry slides every later band up and produces a complete-looking report that
// is wrong throughout.
export function parseDwellByDepth(value: unknown): number[] | null {
  // Absent is silent: a cached pre-feature tracker simply does not send this.
  // A present-but-unusable array is a tracker/constant mismatch, and dropping it
  // quietly makes the UI claim those visitors ran an old tracker.
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length !== DEPTH_BANDS) {
    logger.warn('dwellByDepth rejected: wrong shape', {
      expected: DEPTH_BANDS,
      received: Array.isArray(value) ? value.length : typeof value,
    });
    return null;
  }
  const out: number[] = [];
  for (const entry of value) {
    const ms = parseDurationMs(entry);
    if (ms === null) {
      logger.warn('dwellByDepth rejected: unusable entry', { index: out.length });
      return null;
    }
    out.push(ms);
  }
  // An all-zero array is a legitimate "nothing measured" and needs no warning.
  if (out.every((ms) => ms === 0)) return null;
  return out;
}

export function parseInteractions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const entry = value[i];
    if (out.length >= MAX_INTERACTIONS) {
      logger.warn('interactions truncated at cap; later bands under-report', {
        cap: MAX_INTERACTIONS,
        dropped: value.length - i,
      });
      break;
    }
    if (typeof entry !== 'string') continue;
    const at = entry.indexOf(':');
    if (at <= 0) continue;
    const band = Number(entry.slice(0, at));
    const kind = entry.slice(at + 1);
    if (!Number.isInteger(band) || band < 0 || band >= DEPTH_BANDS) continue;
    if (!INTERACTION_KINDS.has(kind)) continue;
    const canonical = `${band}:${kind}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

export interface EngagementPayload {
  dwellMs: number;
  activeMs: number | null;
  maxScrollPct: number | null;
  exitScrollPct: number | null;
  viewportPct: number | null;
  dwellByDepth: number[];
  interactions: string[];
}

function nonZero(value: number | null): number | null {
  return value === null || value <= 0 ? null : value;
}

export function parseEngagementPayload(metadata: unknown): EngagementPayload | null {
  if (typeof metadata !== 'object' || metadata === null) return null;
  const meta = metadata as Record<string, unknown>;

  const dwellMs = parseDurationMs(meta.timeOnPageMs);
  if (dwellMs === null) return null;

  const e = (typeof meta.engagement === 'object' && meta.engagement !== null
    ? meta.engagement
    : {}) as Record<string, unknown>;

  const rawActive = parseDurationMs(e.activeMs);

  return {
    dwellMs,
    activeMs: rawActive === null ? null : Math.min(rawActive, dwellMs),
    maxScrollPct: parseScrollPct(e.maxScrollPct),
    exitScrollPct: parseScrollPct(e.exitScrollPct),
    viewportPct: nonZero(parseScrollPct(e.viewportPct)),
    dwellByDepth: parseDwellByDepth(e.dwellByDepth) ?? [],
    interactions: parseInteractions(e.interactions),
  };
}
