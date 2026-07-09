import { RolePolicy } from '../domain/role-policy';
import type { IdentityDashboardPort, RoleView } from './ports/inbound';
import type { RoleRepositoryPort, FeatureCatalogPort, DomainEventPublisherPort } from './ports/outbound';

export class RoleDashboardService implements IdentityDashboardPort {
  constructor(
    private readonly roles: RoleRepositoryPort,
    private readonly catalog: FeatureCatalogPort,
    private readonly events: DomainEventPublisherPort,
  ) {}

  async listRoles(): Promise<RoleView[]> {
    const all = await this.roles.listByTenant();
    return all.map(toView);
  }

  async findRole(roleId: string): Promise<RoleView | null> {
    const role = await this.roles.findById(roleId);
    return role ? toView(role) : null;
  }

  async createRole(input: { name: string; description?: string | null; grants?: string[] }): Promise<RoleView> {
    const role = RolePolicy.create({
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      grants: [],
    });
    role.setGrants(input.grants ?? [], this.catalog.allKeys());
    await this.roles.save(role);
    await this.events.publish({ type: 'RoleDefinitionChanged', payload: { roleId: role.id } });
    return toView(role);
  }

  async updateRole(roleId: string, input: { name?: string; description?: string | null }): Promise<RoleView> {
    const role = await this.roles.findById(roleId);
    if (!role) throw new Error('Role not found');
    if (input.name !== undefined) role.rename(input.name);
    if (input.description !== undefined) role.setDescription(input.description);
    await this.roles.save(role);
    await this.events.publish({ type: 'RoleDefinitionChanged', payload: { roleId } });
    return toView(role);
  }

  async updateRoleGrants(roleId: string, grants: string[]): Promise<RoleView> {
    const role = await this.roles.findById(roleId);
    if (!role) throw new Error('Role not found');
    role.setGrants(grants, this.catalog.allKeys()); // throws for system roles
    await this.roles.save(role);
    await this.events.publish({ type: 'RoleDefinitionChanged', payload: { roleId } });
    return toView(role);
  }

  async setRoleFeatures(roleId: string, featureIds: string[]): Promise<RoleView> {
    const role = await this.roles.findById(roleId);
    if (!role) throw new Error('Role not found');
    role.setFeatureGrants(featureIds, this.catalog.allKeys());
    await this.roles.save(role);
    await this.events.publish({ type: 'RoleDefinitionChanged', payload: { roleId } });
    return toView(role);
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await this.roles.findById(roleId);
    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot delete a system role');
    await this.roles.delete(roleId);
    await this.events.publish({ type: 'RoleDefinitionChanged', payload: { roleId } });
  }
}

function toView(role: RolePolicy): RoleView {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    grants: role.grants().map(String),
  };
}
