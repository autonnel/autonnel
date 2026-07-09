import type { DomainEvent } from '../domain/page';
import type { Funnel } from '../domain/funnel';

export interface FunnelRepositoryPort {
  load(funnelId: string): Promise<Funnel | null>;
  save(funnel: Funnel): Promise<void>;
  lastPublishedVersion(funnelId: string): Promise<number | null>;
}

export interface PageExistencePort {
  exists(pageId: string): Promise<boolean>;
}

export interface DomainEventPort {
  publish(events: DomainEvent[]): Promise<void>;
}
