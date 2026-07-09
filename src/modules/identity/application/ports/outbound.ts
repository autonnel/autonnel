import type { UserAccount } from '../../domain/user-account';
import type { TenantMembership } from '../../domain/tenant-membership';
import type { RolePolicy } from '../../domain/role-policy';
import type { Invitation } from '../../domain/invitation';
import type { ApiClientCredential } from '../../domain/api-client-credential';
import type { AuthSession } from '../../domain/auth-session';
import type { Email } from '../../domain/email';
import type { CredentialHash } from '../../domain/credential-hash';

// UN-SCOPED on purpose: global user/email uniqueness bypasses tenant injection.
export interface UserRepositoryPort {
  findByEmailGlobal(email: Email): Promise<UserAccount | null>;
  findById(userId: string): Promise<UserAccount | null>;
  listByIds(userIds: string[]): Promise<UserAccount[]>;
  save(user: UserAccount): Promise<void>;
}

export interface MembershipRepositoryPort {
  findByUserAndTenant(userId: string, tenantId: string): Promise<TenantMembership | null>;
  listByUser(userId: string): Promise<TenantMembership[]>;
  listByTenant(): Promise<TenantMembership[]>;
  countActiveOwners(tenantId: string): Promise<number>;
  save(membership: TenantMembership): Promise<void>;
}

export interface RoleRepositoryPort {
  listByTenant(): Promise<RolePolicy[]>;
  findById(roleId: string): Promise<RolePolicy | null>;
  save(role: RolePolicy): Promise<void>;
  delete(roleId: string): Promise<void>;
}

export interface InvitationListItem {
  id: string;
  email: string;
  invitedRoleIds: string[];
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface InvitationRepositoryPort {
  findByToken(tokenHash: string): Promise<{ invitation: Invitation; tenantId: string } | null>;
  save(invitation: Invitation, tokenHash: string): Promise<void>;
  listByTenant(): Promise<InvitationListItem[]>;
  revokeById(id: string): Promise<boolean>;
}

export interface ApiKeyRepositoryPort {
  // UN-SCOPED hash lookup for auth: global uniqueness bypasses tenant injection.
  findByHashGlobal(keyHash: string): Promise<{ credential: ApiClientCredential; tenantId: string } | null>;
  listByTenant(): Promise<ApiClientCredential[]>;
  save(credential: ApiClientCredential, keyHash: string): Promise<void>;
}

export interface SessionStorePort {
  create(session: AuthSession): Promise<void>;
  findById(sessionId: string): Promise<AuthSession | null>;
  revoke(sessionId: string): Promise<void>;
  // Revoke every active session for the user except the one supplied; returns the count revoked.
  revokeOthersForUser(userId: string, exceptSessionId: string): Promise<number>;
}

export interface PasswordHasherPort {
  hash(plaintext: string): Promise<CredentialHash>;
  verify(plaintext: string, hash: CredentialHash): Promise<boolean>;
}

// Async because workerd has no synchronous HMAC (crypto.subtle is Promise-based).
export interface TokenSignerPort {
  sign(claims: { sessionId: string }): Promise<string>;
  verify(token: string): Promise<{ sessionId: string } | null>;
}

export interface SecretGeneratorPort {
  generatePlaintext(): string;
  hashSecret(plaintext: string): Promise<string>;
  constantTimeEquals(a: string, b: string): boolean;
}

export interface FeatureCatalogPort {
  allKeys(): ReadonlySet<string>;
}

export interface AppConfigPort {
  get(key: string, envFallback?: string): Promise<string | null>;
}

export interface NotificationPort {
  sendAccountEmail(input: { to: string; templateKey: string; vars: Record<string, unknown> }): Promise<void>;
}

export interface DomainEventPublisherPort {
  publish(event: { type: string; payload: Record<string, unknown> }): Promise<void>;
}

export interface ClockPort {
  now(): Date;
}

export interface HostTenantResolverPort {
  resolveFromHost(host: string | null): Promise<string | null>;
}
