import { describe, it, expect, vi } from 'vitest';
import { AuthenticationService } from './authentication-service';
import { UserAccount, UserStatus } from '../domain/user-account';
import { Email } from '../domain/email';
import { CredentialHash } from '../domain/credential-hash';
import { TenantMembership, MembershipStatus } from '../domain/tenant-membership';
import { RolePolicy } from '../domain/role-policy';
import { AuthSession, SessionStatus } from '../domain/auth-session';
import { toFeatureKey } from '../domain/feature-key';
import { DEFAULT_TENANT } from '../../shared-kernel/tenant-id';

function makeDeps(passwordValid: boolean) {
  const user = UserAccount.rehydrate({
    id: 'u1', email: Email.of('a@b.com'), credentialHash: CredentialHash.fromStored('h'),
    status: UserStatus.Active, emailVerifiedAt: new Date(), verificationToken: null, verificationTokenExpiresAt: null,
  });
  const membership = TenantMembership.rehydrate({ id: 'm1', userId: 'u1', roleIds: ['r1'], status: MembershipStatus.Active });
  const role = RolePolicy.create({ id: 'r1', name: 'admin', isSystem: true, grants: [toFeatureKey('ORDERS')] });
  return {
    users: { findByEmailGlobal: vi.fn().mockResolvedValue(user), findById: vi.fn(), save: vi.fn() },
    memberships: {
      findByUserAndTenant: vi.fn().mockResolvedValue(membership),
      listByUser: vi.fn().mockResolvedValue([membership]),
      countActiveOwners: vi.fn(), save: vi.fn(),
    },
    roles: { listByTenant: vi.fn().mockResolvedValue([role]), findById: vi.fn(), save: vi.fn(), delete: vi.fn() },
    sessions: { create: vi.fn(), findById: vi.fn(), revoke: vi.fn() },
    hasher: { hash: vi.fn(), verify: vi.fn().mockResolvedValue(passwordValid) },
    signer: { sign: vi.fn().mockResolvedValue('signed.jwt'), verify: vi.fn().mockResolvedValue(null) },
    clock: { now: () => new Date('2026-06-04T00:00:00Z') },
    auth: undefined as any,
  };
}

describe('AuthenticationService.login', () => {
  it('returns a session token + UserPrincipal with resolved permissions on valid credentials', async () => {
    const d = makeDeps(true);
    const svc = new AuthenticationService(
      d.users as any, d.memberships as any, d.roles as any, d.sessions as any,
      d.hasher as any, d.signer as any, d.clock as any,
    );
    const res = await svc.login({ email: 'a@b.com', password: 'secret123' });
    expect(res.sessionToken).toBe('signed.jwt');
    expect(res.principal.kind).toBe('user');
    expect(res.principal.tenantId).toBe(DEFAULT_TENANT);
    expect(res.principal.permissions.has(toFeatureKey('ORDERS'))).toBe(true);
    expect(d.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('throws on invalid password (no session created)', async () => {
    const d = makeDeps(false);
    const svc = new AuthenticationService(
      d.users as any, d.memberships as any, d.roles as any, d.sessions as any,
      d.hasher as any, d.signer as any, d.clock as any,
    );
    await expect(svc.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(/credentials/i);
    expect(d.sessions.create).not.toHaveBeenCalled();
  });

  it('authenticateSession returns null for a revoked session', async () => {
    const d = makeDeps(true);
    const revoked = AuthSession.rehydrate({
      id: 's1', userId: 'u1', activeTenantId: DEFAULT_TENANT, status: SessionStatus.Revoked,
      absoluteExpiresAt: new Date('2026-06-05T00:00:00Z'), idleExpiresAt: new Date('2026-06-04T01:00:00Z'),
    });
    d.signer.verify = vi.fn().mockResolvedValue({ sessionId: 's1' });
    d.sessions.findById = vi.fn().mockResolvedValue(revoked);
    const svc = new AuthenticationService(
      d.users as any, d.memberships as any, d.roles as any, d.sessions as any,
      d.hasher as any, d.signer as any, d.clock as any,
    );
    expect(await svc.authenticateSession('signed.jwt')).toBeNull();
  });
});
