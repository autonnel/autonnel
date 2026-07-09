import type { ComponentSchema } from '../domain/services/page-validator';

interface ComponentSchemaSource {
  all(): { type: string; allowedZones?: string[]; requiredProps?: string[] }[];
}

export class PluginComponentSchemaResolver {
  constructor(private readonly source: ComponentSchemaSource) {}

  async listSchemas(): Promise<ComponentSchema[]> {
    return this.source.all().map((entry) => ({
      type: entry.type,
      allowedZones: entry.allowedZones ?? ['root'],
      requiredProps: entry.requiredProps ?? [],
    }));
  }
}
