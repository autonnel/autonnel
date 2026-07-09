import type { RawActivityEvent } from '../../domain/activity-event';

export interface ActivityIngestPort {
  recordActivity(input: { events: RawActivityEvent[] }): Promise<{ stored: number }>;
}
