// Rebuilt per isolate (never persisted); ENABLED-per-tenant filtering is applied upstream.
export interface ComponentSchemaEntry {
  type: string;
  allowedZones?: string[];
  requiredProps?: string[];
}

export class InProcessComponentSchemaRegistry {
  private readonly map = new Map<string, ComponentSchemaEntry>();

  register(entry: ComponentSchemaEntry): void {
    this.map.set(entry.type, entry);
  }

  all(): ComponentSchemaEntry[] {
    return [...this.map.values()];
  }
}

const registry = new InProcessComponentSchemaRegistry();

export function getComponentSchemaRegistry(): InProcessComponentSchemaRegistry {
  return registry;
}

export function registerComponentSchema(entry: ComponentSchemaEntry): void {
  registry.register(entry);
}
