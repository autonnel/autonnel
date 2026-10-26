import { describe, it, expect, vi } from 'vitest';
import {
  CUSTOM_EVENT_ATTR,
  MAX_CUSTOM_EVENT_NAMES_PER_PAGE,
  createCustomEventTracker,
  findCustomEventName,
} from './custom-events';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe('findCustomEventName', () => {
  it('reads the attribute off the clicked element itself', () => {
    const el = mount(`<button ${CUSTOM_EVENT_ATTR}="buy_now">Buy</button>`);
    expect(findCustomEventName(el)).toBe('buy_now');
  });

  it('finds the attribute on an ancestor above a button, which the CTA walk stops at', () => {
    const wrapper = mount(`<div ${CUSTOM_EVENT_ATTR}="hero_cta"><button><span id="t">Buy</span></button></div>`);
    const target = wrapper.querySelector('#t');
    expect(findCustomEventName(target)).toBe('hero_cta');
  });

  it('returns the nearest attribute when several ancestors carry one', () => {
    const outer = mount(`<div ${CUSTOM_EVENT_ATTR}="outer"><div ${CUSTOM_EVENT_ATTR}="inner"><b id="t">x</b></div></div>`);
    expect(findCustomEventName(outer.querySelector('#t'))).toBe('inner');
  });

  it('stops after maxDepth ancestors', () => {
    const el = mount(`<div ${CUSTOM_EVENT_ATTR}="deep"><div><div><b id="t">x</b></div></div></div>`);
    expect(findCustomEventName(el.querySelector('#t'), 2)).toBeNull();
  });

  it('returns null when nothing on the path carries the attribute', () => {
    const el = mount('<button>Buy</button>');
    expect(findCustomEventName(el)).toBeNull();
  });

  it('returns null for a non-element target', () => {
    expect(findCustomEventName(null)).toBeNull();
  });
});

describe('createCustomEventTracker', () => {
  function harness() {
    const emit = vi.fn();
    const warn = vi.fn();
    return { emit, warn, tracker: createCustomEventTracker({ emit, warn }) };
  }

  it('emits a valid name with its metadata', () => {
    const h = harness();
    h.tracker.track('video_watched', { seconds: 30 });
    expect(h.emit).toHaveBeenCalledWith('video_watched', { seconds: 30 });
  });

  it('emits null metadata when none is given', () => {
    const h = harness();
    h.tracker.track('buy_now');
    expect(h.emit).toHaveBeenCalledWith('buy_now', null);
  });

  it('drops a non-string name without throwing into the page', () => {
    const h = harness();
    expect(() => h.tracker.track(42 as never)).not.toThrow();
    expect(h.emit).not.toHaveBeenCalled();
    expect(h.warn).toHaveBeenCalled();
  });

  it('drops an invalid name and warns', () => {
    const h = harness();
    h.tracker.track('1st click');
    expect(h.emit).not.toHaveBeenCalled();
    expect(h.warn).toHaveBeenCalled();
  });

  it('drops non-object metadata rather than the whole event', () => {
    const h = harness();
    h.tracker.track('buy_now', 'nope');
    expect(h.emit).toHaveBeenCalledWith('buy_now', null);
  });

  it('caps distinct names per page and drops overflow silently', () => {
    const h = harness();
    for (let i = 0; i < MAX_CUSTOM_EVENT_NAMES_PER_PAGE; i += 1) h.tracker.track(`e${i}`);
    h.emit.mockClear();

    h.tracker.track('brand_new');
    expect(h.emit).not.toHaveBeenCalled();
  });

  it('warns only once about the cap however many names overflow', () => {
    const h = harness();
    for (let i = 0; i < MAX_CUSTOM_EVENT_NAMES_PER_PAGE + 5; i += 1) h.tracker.track(`e${i}`);
    expect(h.warn).toHaveBeenCalledTimes(1);
  });

  it('emits a repeated name only once, keeping the first call metadata', () => {
    const h = harness();
    h.tracker.track('buy_now', { step: 1 });
    h.tracker.track('buy_now', { step: 2 });
    expect(h.emit).toHaveBeenCalledTimes(1);
    expect(h.emit).toHaveBeenCalledWith('buy_now', { step: 1 });
  });

  it('drops a repeat silently rather than warning, since it is normal not a mistake', () => {
    const h = harness();
    h.tracker.track('buy_now');
    h.tracker.track('buy_now');
    expect(h.warn).not.toHaveBeenCalled();
  });

  it('warns only once about the cap even when a repeat is interleaved with overflow', () => {
    const h = harness();
    for (let i = 0; i < MAX_CUSTOM_EVENT_NAMES_PER_PAGE; i += 1) h.tracker.track(`e${i}`);
    h.tracker.track('e0'); // repeat, dropped by the dedupe before the cap check runs
    h.tracker.track('overflow1');
    h.tracker.track('overflow2');
    expect(h.warn).toHaveBeenCalledTimes(1);
  });
});
