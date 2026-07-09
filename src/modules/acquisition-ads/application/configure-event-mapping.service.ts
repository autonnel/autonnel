import { EventMappingProfile, type MappingRule } from '../domain/mapping/event-mapping-profile';
import type { EventMappingRepositoryPort } from './ports/outbound';

interface Deps {
  mappingRepo: EventMappingRepositoryPort;
  newId: () => string;
}

export class ConfigureEventMappingService {
  constructor(private readonly deps: Deps) {}

  async configureMapping(input: { rules: MappingRule[] }): Promise<{ version: number }> {
    const current = await this.deps.mappingRepo.findActive();
    const next = current ? current.withRules(input.rules) : EventMappingProfile.draft({ id: this.deps.newId(), rules: input.rules }).activate();
    await this.deps.mappingRepo.save(next);
    return { version: next.version };
  }
}
