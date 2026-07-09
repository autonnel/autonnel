import { EventMappingProfile } from '../../domain/mapping/event-mapping-profile';
import type { EventMappingRepositoryPort } from '../../application/ports/outbound';

interface MappingDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<any | null>;
  upsert(args: unknown): Promise<unknown>;
}

function toDomain(row: any): EventMappingProfile {
  return EventMappingProfile.reconstitute({
    id: row.id,
    rules: row.rules as any[],
    version: row.version,
    active: row.isActive,
  });
}

export class PrismaEventMappingRepository implements EventMappingRepositoryPort {
  constructor(private readonly delegate: MappingDelegate) {}

  async findActive(): Promise<EventMappingProfile | null> {
    const row = await this.delegate.findFirst({ where: { isActive: true } });
    return row ? toDomain(row) : null;
  }

  async save(profile: EventMappingProfile): Promise<void> {
    await this.delegate.upsert({
      where: { id: profile.id },
      create: {
        id: profile.id,
        version: profile.version,
        isActive: profile.isActive,
        rules: profile.rules,
      },
      update: {
        version: profile.version,
        isActive: profile.isActive,
        rules: profile.rules,
      },
    });
  }
}
