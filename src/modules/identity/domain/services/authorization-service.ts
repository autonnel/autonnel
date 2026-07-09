import { PermissionSet } from '../permission-set';
import type { TenantMembership } from '../tenant-membership';
import type { RolePolicy } from '../role-policy';

export class AuthorizationService {
  resolve(membership: TenantMembership, roles: readonly RolePolicy[]): PermissionSet {
    const assigned = new Set(membership.roleIds);
    let union = PermissionSet.empty();
    for (const role of roles) {
      if (assigned.has(role.id)) union = union.merge(PermissionSet.of(role.grants()));
    }
    return membership.resolvePermissions(union);
  }
}
