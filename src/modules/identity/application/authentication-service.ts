import { AuthSession, SessionStatus } from '../domain/auth-session';
import { Email } from '../domain/email';
import { UserStatus } from '../domain/user-account';
import { AuthorizationService } from '../domain/services/authorization-service';
import { DEFAULT_TENANT } from '../../shared-kernel/tenant-id';
import type { Principal, UserPrincipal } from '../../shared-kernel/principal';
import type {
  UserRepositoryPort, MembershipRepositoryPort, RoleRepositoryPort, SessionStorePort,
  PasswordHasherPort, TokenSignerPort, ClockPort,
} from './ports/outbound';
import type { AuthenticationPort, LoginCommand, LoginResult } from './ports/inbound';

const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_MS = 12 * 60 * 60 * 1000;

export class AuthenticationService implements AuthenticationPort {
  private readonly authz = new AuthorizationService();

  constructor(
    private readonly users: UserRepositoryPort,
    private readonly memberships: MembershipRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly sessions: SessionStorePort,
    private readonly hasher: PasswordHasherPort,
    private readonly signer: TokenSignerPort,
    private readonly clock: ClockPort,
  ) {}

  async login(cmd: LoginCommand): Promise<LoginResult> {
    const user = await this.users.findByEmailGlobal(Email.of(cmd.email));
    if (!user || user.status !== UserStatus.Active) throw new Error('Invalid credentials');
    const ok = await this.hasher.verify(cmd.password, user.credentialHash);
    if (!ok) throw new Error('Invalid credentials');

    const activeTenantId = cmd.activeTenantId ?? (await this.chooseActiveTenant(user.id));
    const principal = await this.buildUserPrincipal(user.id, activeTenantId);

    const now = this.clock.now();
    const session = AuthSession.rehydrate({
      id: crypto.randomUUID(),
      userId: user.id,
      activeTenantId,
      status: SessionStatus.Active,
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_MS),
      idleExpiresAt: new Date(now.getTime() + IDLE_MS),
    });
    await this.sessions.create(session);
    return { sessionToken: await this.signer.sign({ sessionId: session.id }), principal };
  }

  // Mint a session for an already-authenticated user (no password). Used by SaaS owner flows
  // where identity is proven externally (OIDC / email-code). activeTenantId is the tenant the
  // session operates in; the principal is resolved against that tenant's roles.
  async startSessionForUser(userId: string, activeTenantId: string = DEFAULT_TENANT): Promise<LoginResult> {
    const principal = await this.buildUserPrincipal(userId, activeTenantId);
    const now = this.clock.now();
    const session = AuthSession.rehydrate({
      id: crypto.randomUUID(),
      userId,
      activeTenantId,
      status: SessionStatus.Active,
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_MS),
      idleExpiresAt: new Date(now.getTime() + IDLE_MS),
    });
    await this.sessions.create(session);
    return { sessionToken: await this.signer.sign({ sessionId: session.id }), principal };
  }

  async authenticateSession(sessionToken: string): Promise<Principal | null> {
    const claims = await this.signer.verify(sessionToken);
    if (!claims) return null;
    const session = await this.sessions.findById(claims.sessionId);
    if (!session || !session.isValid(this.clock.now())) return null;
    return this.buildUserPrincipal(session.userId, session.activeTenantId);
  }

  async logout(sessionToken: string): Promise<void> {
    const claims = await this.signer.verify(sessionToken);
    if (claims) await this.sessions.revoke(claims.sessionId);
  }

  private async chooseActiveTenant(userId: string): Promise<string> {
    const memberships = await this.memberships.listByUser(userId);
    // OSS single-tenant: there is exactly one membership in DEFAULT_TENANT.
    return memberships.length === 1 ? DEFAULT_TENANT : DEFAULT_TENANT;
  }

  private async buildUserPrincipal(userId: string, tenantId: string): Promise<UserPrincipal> {
    const membership = await this.memberships.findByUserAndTenant(userId, tenantId);
    const roles = await this.roles.listByTenant();
    const permissions = membership
      ? this.authz.resolve(membership, roles)
      : (await import('../domain/permission-set')).PermissionSet.empty();
    return { kind: 'user', userId, tenantId, permissions };
  }
}
