import { PermissionSet } from './permission-set';

export enum MembershipStatus {
  Active = 'active',
  Suspended = 'suspended',
}

interface MembershipState {
  id: string;
  userId: string;
  roleIds: string[];
  status: MembershipStatus;
}

// (userId, tenantId) unique is enforced at the repository.
// Suspended → empty PermissionSet regardless of roles.
export class TenantMembership {
  private constructor(private state: MembershipState) {}

  static rehydrate(state: MembershipState): TenantMembership {
    return new TenantMembership({ ...state, roleIds: [...state.roleIds] });
  }

  static create(input: { id: string; userId: string; roleIds: string[] }): TenantMembership {
    return new TenantMembership({
      id: input.id, userId: input.userId, roleIds: [...new Set(input.roleIds)], status: MembershipStatus.Active,
    });
  }

  get id() { return this.state.id; }
  get userId() { return this.state.userId; }
  get roleIds(): readonly string[] { return this.state.roleIds; }
  get status() { return this.state.status; }

  resolvePermissions(rolesUnion: PermissionSet): PermissionSet {
    if (this.state.status === MembershipStatus.Suspended) return PermissionSet.empty();
    return rolesUnion;
  }

  suspend(): void {
    this.state.status = MembershipStatus.Suspended;
  }

  assignRoles(roleIds: string[]): void {
    this.state.roleIds = [...new Set(roleIds)];
  }
}
