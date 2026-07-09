import { describe, it, expect } from 'vitest';
import { MQEventType } from '@/lib/adapters/mq/types';
import {
  EVENT_CATALOG,
  EVENT_CATALOG_BY_ID,
  knownEventIds,
} from '@/lib/services/notification-events-catalog';

describe('notification events catalog', () => {
  it('covers every MQEventType enum value', () => {
    const enumValues = Object.values(MQEventType);
    const ids = new Set(EVENT_CATALOG.map((e) => e.id));
    for (const v of enumValues) {
      expect(ids.has(v as string), `missing catalog entry for ${v}`).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    const seen = new Set<string>();
    for (const e of EVENT_CATALOG) {
      expect(seen.has(e.id), `duplicate id ${e.id}`).toBe(false);
      seen.add(e.id);
    }
  });

  it('every entry has a non-empty label and a group', () => {
    for (const e of EVENT_CATALOG) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.group.length).toBeGreaterThan(0);
    }
  });

  it('includes the conversion-analysis event in the analysis group', () => {
    const entry = EVENT_CATALOG_BY_ID.get('analysis.conversion_completed');
    expect(entry).toBeDefined();
    expect(entry?.group).toBe('analysis');
  });

  it('knownEventIds returns the same length as the catalog', () => {
    expect(knownEventIds().length).toBe(EVENT_CATALOG.length);
  });
});
