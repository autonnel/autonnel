import { Domain, DomainSet } from '../domain/domain';
import type { DomainRepository } from './ports';

export class ManageDomainsService {
  constructor(
    private readonly repo: DomainRepository,
    private readonly tenantId: () => string,
  ) {}

  async list(): Promise<Domain[]> {
    return this.repo.list();
  }

  async add(input: { host: string; isPrimary?: boolean }): Promise<Domain> {
    const existing = await this.repo.list();
    const candidate = Domain.create({ tenantId: this.tenantId(), host: input.host, isPrimary: input.isPrimary });
    const set = new DomainSet(existing);
    const shouldBePrimary = set.resolveNewPrimary(candidate.isPrimary);

    // Global check, not tenant-scoped: two tenants claiming one host makes host->tenant routing
    // ambiguous. The DB unique index is the real guard; this only produces a clean error first.
    if (await this.repo.findByHostAcrossTenants(candidate.host)) {
      throw new DomainConflictError(candidate.host);
    }
    candidate.isPrimary = false;
    let created: Domain;
    try {
      created = await this.repo.create(candidate);
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new DomainConflictError(candidate.host);
      throw err;
    }
    if (shouldBePrimary) return this.repo.setPrimary(created.id);
    return created;
  }

  async setPrimary(id: string): Promise<Domain> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new DomainNotFoundError(id);
    return this.repo.setPrimary(id);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new DomainNotFoundError(id);
    await this.repo.delete(id);
  }
}

export class DomainConflictError extends Error {
  constructor(host: string) {
    super(`Domain already in use: ${host}`);
    this.name = 'DomainConflictError';
  }
}

export class DomainNotFoundError extends Error {
  constructor(id: string) {
    super(`Domain not found: ${id}`);
    this.name = 'DomainNotFoundError';
  }
}
