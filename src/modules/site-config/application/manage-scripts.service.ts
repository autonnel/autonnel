import { GlobalScript } from '../domain/global-script';
import type { GlobalScriptRepository } from './ports';

export class ManageScriptsService {
  constructor(
    private readonly repo: GlobalScriptRepository,
    private readonly tenantId: () => string,
    private readonly onChange?: (tenantId: string) => Promise<void>,
  ) {}

  async list(): Promise<GlobalScript[]> {
    return this.repo.list();
  }

  async create(input: {
    name: string;
    content: string;
    position: string;
    enabled?: boolean;
    order?: number;
  }): Promise<GlobalScript> {
    const script = GlobalScript.create({ tenantId: this.tenantId(), ...input });
    const created = await this.repo.create(script);
    await this.onChange?.(this.tenantId());
    return created;
  }

  async update(
    id: string,
    patch: { name?: string; content?: string; position?: string; enabled?: boolean; order?: number },
  ): Promise<GlobalScript> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ScriptNotFoundError(id);
    existing.applyEdit(patch);
    const updated = await this.repo.update(existing);
    await this.onChange?.(this.tenantId());
    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ScriptNotFoundError(id);
    await this.repo.delete(id);
    await this.onChange?.(this.tenantId());
  }
}

export class ScriptNotFoundError extends Error {
  constructor(id: string) {
    super(`Script not found: ${id}`);
    this.name = 'ScriptNotFoundError';
  }
}
