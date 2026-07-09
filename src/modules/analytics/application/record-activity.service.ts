import { normalizeActivityEvent, type RawActivityEvent } from '../domain/activity-event';
import type { ActivityEventRow, ActivityEventStorePort } from './ports/outbound';
import type { ActivityIngestPort } from './ports/inbound';

const MAX_BATCH = 50;

export interface RecordActivityDeps {
  store: ActivityEventStorePort;
}

export class RecordActivityService implements ActivityIngestPort {
  constructor(private readonly deps: RecordActivityDeps) {}

  async recordActivity(input: { events: RawActivityEvent[] }): Promise<{ stored: number }> {
    const rows: ActivityEventRow[] = [];
    for (const raw of input.events.slice(0, MAX_BATCH)) {
      try {
        rows.push(normalizeActivityEvent(raw));
      } catch {
        // Best-effort log: a single invalid event never fails the batch.
      }
    }
    if (rows.length === 0) return { stored: 0 };
    await this.deps.store.appendActivity(rows);
    return { stored: rows.length };
  }
}
