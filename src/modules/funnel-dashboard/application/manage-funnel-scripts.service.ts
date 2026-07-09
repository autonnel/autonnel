import { FunnelScript } from '../domain/funnel-script';
import type { FunnelScriptRepository } from './ports';

export class FunnelScriptNotFoundError extends Error {
  constructor(id: string) {
    super(`Script not found: ${id}`);
    this.name = 'FunnelScriptNotFoundError';
  }
}

export class ManageFunnelScriptsService {
  constructor(
    private readonly repo: FunnelScriptRepository,
    private readonly onChange?: (funnelId: string) => Promise<void>,
  ) {}

  list(funnelId: string): Promise<FunnelScript[]> {
    return this.repo.listByFunnel(funnelId);
  }

  async create(input: {
    funnelId: string;
    name: string;
    content: string;
    position: string;
    isActive?: boolean;
    order?: number;
  }): Promise<FunnelScript> {
    const script = FunnelScript.create(input);
    const created = await this.repo.create(script);
    await this.onChange?.(input.funnelId);
    return created;
  }

  async update(
    id: string,
    patch: { name?: string; content?: string; position?: string; isActive?: boolean; order?: number },
  ): Promise<FunnelScript> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new FunnelScriptNotFoundError(id);
    existing.applyEdit(patch);
    const updated = await this.repo.update(existing);
    await this.onChange?.(existing.funnelId);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new FunnelScriptNotFoundError(id);
    await this.repo.delete(id);
    await this.onChange?.(existing.funnelId);
  }
}
