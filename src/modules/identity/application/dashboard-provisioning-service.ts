// Unlike RegistrationFlowService this never requires an invitation; idempotent so re-running
// grants Admin to an already-existing account.
import { TenantMembership } from '../domain/tenant-membership';
import { RolePolicy } from '../domain/role-policy';
import { DEFAULT_TENANT } from '../../shared-kernel/tenant-id';
import type { RegistrationService } from './registration-service';
import type { MembershipRepositoryPort, RoleRepositoryPort, FeatureCatalogPort } from './ports/outbound';

export class DashboardProvisioningService {
  constructor(
    private readonly registration: RegistrationService,
    private readonly memberships: MembershipRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly catalog: FeatureCatalogPort,
  ) {}

  async provisionAdmin(input: { email: string; password: string }): Promise<{ userId: string; created: boolean }> {
    const { userId, created } = await this.registration.register({ email: input.email, password: input.password });
    const roleId = await this.ensureAdminRole();
    await this.ensureMembership(userId, [roleId]);
    return { userId, created };
  }

  private async ensureAdminRole(): Promise<string> {
    const existing = await this.roles.listByTenant();
    const admin = existing.find((r) => r.name.toLowerCase() === 'admin');
    if (admin) return admin.id;
    const role = RolePolicy.create({ id: crypto.randomUUID(), name: 'Admin', description: 'Full access', isSystem: true, grants: [] });
    role.setFeatureGrants([...this.catalog.allKeys()], this.catalog.allKeys());
    await this.roles.save(role);
    return role.id;
  }

  private async ensureMembership(userId: string, roleIds: string[]): Promise<void> {
    const existing = await this.memberships.findByUserAndTenant(userId, DEFAULT_TENANT);
    const membership = existing ?? TenantMembership.create({ id: crypto.randomUUID(), userId, roleIds });
    if (existing) existing.assignRoles(roleIds);
    await this.memberships.save(membership);
  }
}
