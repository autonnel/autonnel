import type { PermissionSet } from './permission-set';

export interface UserPrincipal {
  readonly kind: 'user';
  readonly userId: string;
  readonly tenantId: string;
  readonly permissions: PermissionSet;
}

export interface ApiClientPrincipal {
  readonly kind: 'apiClient';
  readonly apiKeyId: string;
  readonly tenantId: string;
  readonly permissions: PermissionSet;
  readonly writeAccess: boolean;
}

export type Principal = UserPrincipal | ApiClientPrincipal;

export function isUserPrincipal(p: Principal): p is UserPrincipal {
  return p.kind === 'user';
}

export function isApiClientPrincipal(p: Principal): p is ApiClientPrincipal {
  return p.kind === 'apiClient';
}
