import { bandForPct, emptyBands } from '@/lib/stats/engagement';

export const TICK_MS = 500;
const MAX_INTERACTIONS = 100;
const MAX_DWELL_EVENTS = 240;

export interface PageMetrics {
  docHeight: number;
  scrollTop: number;
  viewportHeight: number;
}

export interface AttentionDeps {
  now?: () => number;
  metrics?: () => PageMetrics;
  isVisible?: () => boolean;
}

export interface AttentionSnapshot {
  activeMs: number;
  dwellByDepth: number[];
  interactions: string[];
  maxScrollPct: number | null;
  exitScrollPct: number | null;
  viewportPct: number | null;
}

export interface AttentionTracker {
  tick(): void;
  sampleScroll(): void;
  note(kind: string): void;
  snapshot(): AttentionSnapshot;
}

function domMetrics(): PageMetrics {
  return {
    docHeight: document.documentElement.scrollHeight || document.body.scrollHeight || 0,
    scrollTop: window.pageYOffset || document.documentElement.scrollTop || 0,
    viewportHeight: window.innerHeight || document.documentElement.clientHeight || 0,
  };
}

export function createAttentionTracker(deps: AttentionDeps = {}): AttentionTracker {
  const now = deps.now ?? (() => Date.now());
  const metrics = deps.metrics ?? domMetrics;
  const isVisible = deps.isVisible ?? (() => document.visibilityState !== 'hidden');

  interface DwellEvent {
    elapsed: number;
    scrollTop: number;
    viewportHeight: number;
  }

  interface InteractionRecord {
    scrollTop: number;
    viewportHeight: number;
    kind: string;
  }

  let activeMs = 0;
  let last = now();
  // The elapsed slice belongs to the state the page was in BEFORE this call.
  let wasVisible = isVisible();
  let maxBottomPx = 0;
  let sampled = false;
  // Anchor all proportional computations to the tallest height observed, so
  // lazy-loaded content does not dilute early dwell across bands.
  let maxDocHeight = 0;
  const dwell = emptyBands();
  const dwellEvents: DwellEvent[] = [];
  const acts: InteractionRecord[] = [];

  function normalizedMetrics(): PageMetrics {
    const m = metrics();
    if (m.docHeight > maxDocHeight) {
      maxDocHeight = m.docHeight;
    }
    return {
      docHeight: maxDocHeight,
      scrollTop: m.scrollTop,
      viewportHeight: m.viewportHeight,
    };
  }

  function toPct(bottomPx: number, docHeight: number): number | null {
    if (!Number.isFinite(bottomPx) || !Number.isFinite(docHeight) || docHeight <= 0) return null;
    const pct = Math.round((bottomPx / docHeight) * 100);
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
  }

  function flushDwellEvents(docHeight: number): void {
    if (docHeight <= 0) return;
    for (const event of dwellEvents) {
      const first = bandForPct((event.scrollTop / docHeight) * 100);
      const lastBand = bandForPct(((event.scrollTop + event.viewportHeight - 1) / docHeight) * 100);
      for (let b = first; b <= lastBand; b += 1) dwell[b] += event.elapsed;
    }
    dwellEvents.length = 0;
  }

  function sampleScroll(): void {
    const m = normalizedMetrics();
    const bottom = m.scrollTop + m.viewportHeight;
    if (!sampled || bottom > maxBottomPx) {
      maxBottomPx = bottom;
      sampled = true;
    }
  }

  function tick(): void {
    const at = now();
    const elapsed = at - last;
    last = at;
    const credit = wasVisible;
    wasVisible = isVisible();
    if (!credit || elapsed <= 0) return;
    // Counted before the height check: a document not yet measurable is still
    // a page the visitor is looking at.
    activeMs += elapsed;
    const m = normalizedMetrics();
    if (m.docHeight <= 0) return;
    dwellEvents.push({ elapsed, scrollTop: m.scrollTop, viewportHeight: m.viewportHeight });
    if (dwellEvents.length >= MAX_DWELL_EVENTS) {
      flushDwellEvents(maxDocHeight);
    }
  }

  function note(kind: string): void {
    if (acts.length >= MAX_INTERACTIONS) return;
    const m = normalizedMetrics();
    if (m.docHeight <= 0) return;
    acts.push({ scrollTop: m.scrollTop, viewportHeight: m.viewportHeight, kind });
  }

  function snapshot(): AttentionSnapshot {
    tick();
    sampleScroll();
    const m = normalizedMetrics();

    // Flush all remaining dwell events using the final normalized height. Two
    // minutes of 500ms ticks is the window during which lazy-loaded content
    // typically changes page height; dwell flushed before later growth cannot
    // be re-bucketed, which is the accepted cost of bounding memory.
    flushDwellEvents(m.docHeight);

    // Resolve interactions at snapshot time against the final height. This
    // matches the dwell replay logic: clicks during page load are attributed
    // to bands in the finished document, not the temporary interim height.
    const interactionSet = new Set<string>();
    for (const act of acts) {
      const mid = act.scrollTop + act.viewportHeight / 2;
      const band = bandForPct((mid / m.docHeight) * 100);
      if (band >= 0) {
        interactionSet.add(`${band}:${act.kind}`);
      }
    }
    const interactions = Array.from(interactionSet);

    const viewportPct = m.docHeight > 0 && m.viewportHeight > 0
      ? Math.max(1, Math.min(100, Math.round((m.viewportHeight / m.docHeight) * 100)))
      : null;
    return {
      activeMs: Math.round(activeMs),
      dwellByDepth: dwell.map((ms) => Math.round(ms)),
      interactions,
      maxScrollPct: toPct(maxBottomPx, m.docHeight),
      exitScrollPct: toPct(m.scrollTop + m.viewportHeight, m.docHeight),
      viewportPct,
    };
  }

  return { tick, sampleScroll, note, snapshot };
}
