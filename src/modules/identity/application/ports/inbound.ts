import type { Principal } from '../../../shared-kernel/principal';
import type { FeatureKey } from '../../domain/feature-key';

export interface LoginCommand { email: string; password: string; activeTenantId?: string; }
export interface LoginResult { sessionToken: string; principal: Principal; }

export interface AuthenticationPort {
  login(cmd: LoginCommand): Promise<LoginResult>;
  authenticateSession(sessionToken: string): Promise<Principal | null>;
  logout(sessionToken: string): Promise<void>;
}

export interface TenantContextPort {
  runWithResolvedContext<T>(req: Request, fn: () => Promise<T>): Promise<T>;
}

export interface PrincipalResolutionPort {
  getPrincipal(): Principal | null;
  getTenantId(): string;
  requireFeature(key: FeatureKey): void;
}

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  grants: string[];
}

export interface IdentityDashboardPort {
  listRoles(): Promise<RoleView[]>;
  findRole(roleId: string): Promise<RoleView | null>;
  createRole(input: { name: string; description?: string | null; grants?: string[] }): Promise<RoleView>;
  updateRole(roleId: string, input: { name?: string; description?: string | null }): Promise<RoleView>;
  updateRoleGrants(roleId: string, grants: string[]): Promise<RoleView>;
  deleteRole(roleId: string): Promise<void>;
}
