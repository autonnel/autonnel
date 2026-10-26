import { isValidCustomEventName } from '@/lib/analytics/custom-event-name';

export const CUSTOM_EVENT_ATTR = 'data-autonnel-event';
export const MAX_CUSTOM_EVENT_NAMES_PER_PAGE = 20;
const DEFAULT_MAX_DEPTH = 6;

// The attention tracker's click walk returns early at the first a/button, so a
// data-autonnel-event on an outer wrapper would be invisible to it. This walk is
// deliberately independent rather than folded into that one.
export function findCustomEventName(start: EventTarget | null, maxDepth = DEFAULT_MAX_DEPTH): string | null {
  let el = start instanceof Element ? start : null;
  for (let depth = 0; depth < maxDepth && el; depth += 1) {
    const value = el.getAttribute(CUSTOM_EVENT_ATTR);
    if (value) {
      const name = value.trim();
      if (name) return name;
    }
    el = el.parentElement;
  }
  return null;
}

export interface CustomEventTrackerDeps {
  emit(name: string, metadata: Record<string, unknown> | null): void;
  warn(message: string): void;
}

export interface CustomEventTracker {
  track(name: unknown, metadata?: unknown): void;
}

// Caps distinct names per page: a page that builds names out of data, such as
// track('click_' + productId), would otherwise mint unbounded kinds. Combined with the
// per-name dedupe below, a page load can send at most MAX_CUSTOM_EVENT_NAMES_PER_PAGE
// custom events, well under the send queue's cap.
export function createCustomEventTracker(deps: CustomEventTrackerDeps): CustomEventTracker {
  const seen = new Set<string>();
  let cappedWarned = false;

  return {
    track(name: unknown, metadata?: unknown): void {
      if (typeof name !== 'string' || !isValidCustomEventName(name)) {
        deps.warn(`autonnel: ignored custom event with invalid name: ${String(name)}`);
        return;
      }
      // Each name fires at most once per page load: the read path only ever counts
      // distinct visitors per (step, name), so a repeat contributes nothing to any
      // displayed number. This also means only the first call's metadata for a given
      // name is ever stored - later calls with the same name are dropped silently,
      // not warned, since a repeat is normal (a scroll handler, a rapid click) rather
      // than a mistake.
      if (seen.has(name)) return;
      if (seen.size >= MAX_CUSTOM_EVENT_NAMES_PER_PAGE) {
        if (!cappedWarned) {
          cappedWarned = true;
          deps.warn(`autonnel: custom event name limit reached (${MAX_CUSTOM_EVENT_NAMES_PER_PAGE}), dropping "${name}"`);
        }
        return;
      }
      seen.add(name);
      const bounded =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? (metadata as Record<string, unknown>)
          : null;
      deps.emit(name, bounded);
    },
  };
}
