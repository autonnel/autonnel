
import type { Domain, Prisma } from '@prisma/client';
import { getBasePrisma } from '../db';
import { withTenantWhere, withTenantData, currentTenantId } from './tenant-helpers';

export class DomainHostConflictError extends Error {
  constructor(host: string) {
    super(`Domain host already exists: ${host}`);
    this.name = 'DomainHostConflictError';
  }
}

export class DomainNotFoundError extends Error {
  constructor(id: string) {
    super(`Domain not found: ${id}`);
    this.name = 'DomainNotFoundError';
  }
}

export interface CreateDomainInput {
  host: string;
  isPrimary?: boolean;
}

export interface UpdateDomainInput {
  host?: string;
  isPrimary?: boolean;
}

export interface IDomainRepository {
  create(data: CreateDomainInput): Promise<Domain>;
  findById(id: string): Promise<Domain | null>;
  findByHost(host: string): Promise<Domain | null>;
  list(): Promise<Domain[]>;
  getPrimary(): Promise<Domain | null>;
  setPrimary(domainId: string): Promise<Domain>;
  update(id: string, data: UpdateDomainInput): Promise<Domain>;
  delete(id: string): Promise<void>;
  hostExists(host: string, excludeId?: string): Promise<boolean>;
}

export class PrismaDomainRepository implements IDomainRepository {
  async create(data: CreateDomainInput): Promise<Domain> {
    const tenantId = currentTenantId();
    if (await this.hostExists(data.host)) {
      throw new DomainHostConflictError(data.host);
    }
    if (data.isPrimary) {
      await getBasePrisma().domain.updateMany({
        where: { tenantId },
        data: { isPrimary: false },
      });
    }
    return getBasePrisma().domain.create({
      data: withTenantData({
        host: data.host,
        isPrimary: data.isPrimary ?? false,
      }),
    });
  }

  async findById(id: string): Promise<Domain | null> {
    return getBasePrisma().domain.findFirst({
      where: withTenantWhere({ id }),
    });
  }

  // before tenant context exists. Callers must NOT depend on the current tenant.
  async findByHost(host: string): Promise<Domain | null> {
    return getBasePrisma().domain.findFirst({
      where: { host },
    });
  }

  async list(): Promise<Domain[]> {
    return getBasePrisma().domain.findMany({
      where: withTenantWhere({}),
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getPrimary(): Promise<Domain | null> {
    return getBasePrisma().domain.findFirst({
      where: withTenantWhere({ isPrimary: true }),
    });
  }

  async setPrimary(domainId: string): Promise<Domain> {
    const tenantId = currentTenantId();
    const existing = await this.findById(domainId);
    if (!existing) throw new DomainNotFoundError(domainId);

    await getBasePrisma().domain.updateMany({
      where: { tenantId, id: { not: domainId } },
      data: { isPrimary: false },
    });
    const result = await getBasePrisma().domain.updateMany({
      where: { tenantId, id: domainId },
      data: { isPrimary: true },
    });
    if (result.count === 0) throw new DomainNotFoundError(domainId);
    return (await this.findById(domainId))!;
  }

  async update(id: string, data: UpdateDomainInput): Promise<Domain> {
    if (data.host !== undefined && await this.hostExists(data.host, id)) {
      throw new DomainHostConflictError(data.host);
    }
    const updateData: Prisma.DomainUpdateInput = {};
    if (data.host !== undefined) updateData.host = data.host;
    if (data.isPrimary !== undefined) {
      if (data.isPrimary) {
        await getBasePrisma().domain.updateMany({
          where: { tenantId: currentTenantId(), id: { not: id } },
          data: { isPrimary: false },
        });
      }
      updateData.isPrimary = data.isPrimary;
    }
    const result = await getBasePrisma().domain.updateMany({
      where: { tenantId: currentTenantId(), id },
      data: updateData,
    });
    if (result.count === 0) throw new DomainNotFoundError(id);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await getBasePrisma().domain.deleteMany({ where: withTenantWhere({ id }) });
  }

  async hostExists(host: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.DomainWhereInput = { host };
    if (excludeId) where.id = { not: excludeId };
    const count = await getBasePrisma().domain.count({ where });
    return count > 0;
  }
}

let instance: IDomainRepository | null = null;

export function getDomainRepository(): IDomainRepository {
  if (!instance) {
    instance = new PrismaDomainRepository();
  }
  return instance;
}

export function setDomainRepository(repo: IDomainRepository): void {
  instance = repo;
}
