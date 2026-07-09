import type { FunnelRepository, FunnelSummary } from './ports';

export class FunnelNotFoundError extends Error {
  constructor(id: string) {
    super(`Funnel not found: ${id}`);
    this.name = 'FunnelNotFoundError';
  }
}

export class ManageFunnelsService {
  constructor(private readonly repo: FunnelRepository) {}

  list(): Promise<FunnelSummary[]> {
    return this.repo.list();
  }

  async get(id: string): Promise<FunnelSummary> {
    const funnel = await this.repo.findById(id);
    if (!funnel) throw new FunnelNotFoundError(id);
    return funnel;
  }

  async create(input: { name: string; description?: string | null }): Promise<FunnelSummary> {
    const name = (input.name ?? '').trim();
    if (!name) throw new Error('Name is required');
    return this.repo.create({ name, description: input.description?.trim() || null });
  }

  async update(id: string, patch: { name?: string; description?: string | null }): Promise<FunnelSummary> {
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new Error('name cannot be empty');
    }
    if (patch.name === undefined && patch.description === undefined) {
      throw new Error('At least one of name or description is required');
    }
    const next: { name?: string; description?: string | null } = {};
    if (patch.name !== undefined) next.name = patch.name.trim();
    if (patch.description !== undefined) next.description = patch.description?.trim() || null;
    const updated = await this.repo.update(id, next);
    if (!updated) throw new FunnelNotFoundError(id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const ok = await this.repo.delete(id);
    if (!ok) throw new FunnelNotFoundError(id);
  }

  async duplicate(id: string, opts?: { clonePages?: boolean }): Promise<FunnelSummary> {
    const source = await this.repo.findById(id);
    if (!source) throw new FunnelNotFoundError(id);
    const copy = await this.repo.duplicate(id, `${source.name} (Copy)`, opts);
    if (!copy) throw new FunnelNotFoundError(id);
    return copy;
  }
}
