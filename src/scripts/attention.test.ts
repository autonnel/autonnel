import { describe, it, expect } from 'vitest';
import { DEPTH_BANDS } from '@/lib/stats/engagement';
import { createAttentionTracker, type PageMetrics } from './attention';

function harness(initial: PageMetrics) {
  let clock = 0;
  let visible = true;
  let metrics = { ...initial };
  const tracker = createAttentionTracker({
    now: () => clock,
    metrics: () => metrics,
    isVisible: () => visible,
  });
  return {
    tracker,
    advance(ms: number) { clock += ms; },
    hide() { visible = false; },
    show() { visible = true; },
    setMetrics(next: Partial<PageMetrics>) { metrics = { ...metrics, ...next }; },
  };
}

// A twenty-screen page: one screen covers 5% of the document.
const TALL: PageMetrics = { docHeight: 10_000, scrollTop: 0, viewportHeight: 500 };

describe('createAttentionTracker', () => {
  it('accrues foreground time across ticks', () => {
    const h = harness(TALL);
    h.advance(1_000);
    h.tracker.tick();
    h.advance(2_000);
    h.tracker.tick();
    expect(h.tracker.snapshot().activeMs).toBe(3_000);
  });

  it('credits the slice before a tab switch, then stops accruing', () => {
    // Reading visibilityState fresh would discard the last slice before the
    // switch, which on a page someone reads then abandons is the most
    // informative slice there is.
    const h = harness(TALL);
    h.advance(4_000);
    h.hide();
    h.tracker.tick();
    h.advance(60_000);
    h.tracker.tick();
    expect(h.tracker.snapshot().activeMs).toBe(4_000);
  });

  it('resumes accruing when the tab comes back', () => {
    const h = harness(TALL);
    h.hide();
    h.tracker.tick();
    h.advance(60_000);
    h.tracker.tick();
    h.show();
    h.tracker.tick();
    h.advance(1_000);
    h.tracker.tick();
    expect(h.tracker.snapshot().activeMs).toBe(1_000);
  });

  it('credits every band the viewport covers, not just the middle one', () => {
    // On a short page the viewport spans a large share of the document;
    // crediting one band would report the rest as unseen while it was on
    // screen the whole time.
    const h = harness({ docHeight: 1_000, scrollTop: 0, viewportHeight: 500 });
    h.advance(1_000);
    h.tracker.tick();
    const dwell = h.tracker.snapshot().dwellByDepth;
    expect(dwell.slice(0, 10).every((ms) => ms === 1_000)).toBe(true);
    expect(dwell.slice(10).every((ms) => ms === 0)).toBe(true);
  });

  it('keeps the deepest point in pixels so lazy-loaded content cannot dilute it', () => {
    // Landing pages grow during the session. A percentage taken while
    // scrolling would be diluted by content that did not exist yet.
    const h = harness(TALL);
    h.setMetrics({ scrollTop: 9_500 });
    h.tracker.sampleScroll();
    h.setMetrics({ scrollTop: 0 });
    h.tracker.sampleScroll();
    expect(h.tracker.snapshot().maxScrollPct).toBe(100);
  });

  it('reports a page shorter than the viewport as fully seen', () => {
    const h = harness({ docHeight: 400, scrollTop: 0, viewportHeight: 800 });
    h.tracker.sampleScroll();
    expect(h.tracker.snapshot().maxScrollPct).toBe(100);
  });

  it('clamps rubber-band overscroll to zero', () => {
    const h = harness({ docHeight: 10_000, scrollTop: -300, viewportHeight: 200 });
    h.tracker.sampleScroll();
    expect(h.tracker.snapshot().maxScrollPct).toBe(0);
  });

  it('reports the viewport share of the document', () => {
    const h = harness(TALL);
    expect(h.tracker.snapshot().viewportPct).toBe(5);
  });

  it('is null on an unmeasurable document', () => {
    const h = harness({ docHeight: 0, scrollTop: 0, viewportHeight: 500 });
    h.tracker.sampleScroll();
    const snap = h.tracker.snapshot();
    expect(snap.maxScrollPct).toBeNull();
    expect(snap.viewportPct).toBeNull();
  });

  it('still accrues foreground time on an unmeasurable document', () => {
    // A page that has not been measured yet is still a page being looked at.
    const h = harness({ docHeight: 0, scrollTop: 0, viewportHeight: 500 });
    h.advance(2_000);
    h.tracker.tick();
    expect(h.tracker.snapshot().activeMs).toBe(2_000);
  });

  it('attributes an interaction to the band under the viewport midpoint', () => {
    // The midpoint rather than the top edge: with a sticky header the top of
    // the viewport is often still the previous screenful.
    const h = harness({ docHeight: 10_000, scrollTop: 4_750, viewportHeight: 500 });
    h.tracker.note('cta');
    expect(h.tracker.snapshot().interactions).toEqual(['10:cta']);
  });

  it('records one interaction per band per kind', () => {
    const h = harness(TALL);
    h.tracker.note('cta');
    h.tracker.note('cta');
    h.tracker.note('video');
    expect(h.tracker.snapshot().interactions).toEqual(['0:cta', '0:video']);
  });

  it('emits a dwell array of exactly the band count', () => {
    const h = harness(TALL);
    h.advance(500);
    h.tracker.tick();
    expect(h.tracker.snapshot().dwellByDepth).toHaveLength(DEPTH_BANDS);
  });

  it('takes a final tick when snapshotting so the last slice is not lost', () => {
    const h = harness(TALL);
    h.advance(700);
    expect(h.tracker.snapshot().activeMs).toBe(700);
  });

  it('anchors band credit to the tallest observed page height', () => {
    // A page that grows during the session should not smear early dwell
    // across bands based on its temporary height.
    const h = harness({ docHeight: 1_000, scrollTop: 0, viewportHeight: 500 });
    h.advance(1_000);
    h.tracker.tick();
    h.setMetrics({ docHeight: 10_000 });
    h.advance(1_000);
    h.tracker.tick();
    const dwell = h.tracker.snapshot().dwellByDepth;
    expect(dwell[9]).toBe(0);
    expect(dwell[0]).toBe(2_000);
  });

  it('reports a growing page with the final viewport percentage', () => {
    // On a page that grows from 1000px to 10000px, the 500px viewport should
    // report as 5% of the final height, not 50% of the initial.
    const h = harness({ docHeight: 1_000, scrollTop: 0, viewportHeight: 500 });
    h.setMetrics({ docHeight: 10_000 });
    expect(h.tracker.snapshot().viewportPct).toBe(5);
  });

  it('attributes interactions against the final document height', () => {
    // Clicks during page load should be attributed to bands in the finished
    // document, not the interim height. Before the fix, a click at the midpoint
    // of a 1000px viewport (250px) would resolve to band 5 in a 1000px document.
    const h = harness({ docHeight: 1_000, scrollTop: 0, viewportHeight: 500 });
    h.tracker.note('cta');
    h.setMetrics({ docHeight: 10_000 });
    expect(h.tracker.snapshot().interactions).toEqual(['0:cta']);
  });

  it('deduplicates interactions after band resolution at snapshot time', () => {
    // Two clicks at different scroll positions that resolve to the same band
    // after growth should produce a single deduplicated entry.
    const h = harness({ docHeight: 1_000, scrollTop: 0, viewportHeight: 500 });
    h.tracker.note('cta');
    h.setMetrics({ scrollTop: 100 });
    h.tracker.note('cta');
    h.setMetrics({ docHeight: 10_000 });
    expect(h.tracker.snapshot().interactions).toEqual(['0:cta']);
  });

  it('bounds dwell event buffer and preserves total elapsed time', () => {
    // Drive more than MAX_DWELL_EVENTS ticks. The buffer flushes periodically,
    // so the total dwell equals total visible time even after many cycles.
    const h = harness(TALL);
    for (let i = 0; i < 500; i += 1) {
      h.advance(100);
      h.tracker.tick();
    }
    const snap = h.tracker.snapshot();
    const totalDwell = snap.dwellByDepth.reduce((sum, ms) => sum + ms, 0);
    expect(snap.activeMs).toBe(50_000);
    expect(totalDwell).toBe(50_000);
  });
});
