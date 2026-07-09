import { AuthSession, SessionStatus } from '../domain/auth-session';
import { TenantMembership } from '../domain/tenant-membership';
import { RolePolicy } from '../domain/role-policy';
import { Email } from '../domain/email';
import { DEFAULT_TENANT } from '../../shared-kernel/tenant-id';
import { getTenantId } from './principal-resolution';
import type { RegistrationService } from './registration-service';
import type { InvitationService } from './invitation-service';
import type {
  MembershipRepositoryPort, RoleRepositoryPort, SessionStorePort, TokenSignerPort,
  FeatureCatalogPort, ClockPort,
} from './ports/outbound';

const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_MS = 12 * 60 * 60 * 1000;

export class RegistrationRequiresInvitationError extends Error {
  constructor() { super('Registration requires an invitation token'); this.name = 'RegistrationRequiresInvitationError'; }
}

export class RegistrationFlowService {
  constructor(
    private readonly registration: RegistrationService,
    private readonly invitations: InvitationService,
    private readonly memberships: MembershipRepositoryPort,
    private readonly roles: RoleRepositoryPort,
    private readonly sessions: SessionStorePort,
    private readonly signer: TokenSignerPort,
    private readonly catalog: FeatureCatalogPort,
    private readonly clock: ClockPort,
  ) {}

  async register(input: { email: string; password: string; invitationToken?: string }): Promise<{ sessionToken: string }> {
    // Validate the identifier before any read/write: ensureAdminRole persists
    // state, so a malformed email must fail before it runs.
    Email.of(input.email);

    const existingMembers = await this.memberships.listByTenant();
    const isFirstUser = existingMembers.length === 0;

    let roleIds: string[];
    if (isFirstUser) {
      roleIds = [await this.ensureAdminRole()];
    } else {
      if (!input.invitationToken) throw new RegistrationRequiresInvitationError();
      // Credentials must be validated before accept() consumes the invitation:
      // an invitee who already has an account keeps their current password (the
      // form's password is ignored by the idempotent register), so a mismatch
      // must fail here while the invitation is still pending and retryable.
      await this.registration.precheckCredentials({ email: input.email, password: input.password });
      roleIds = await this.acceptInvitation(input.email, input.invitationToken);
    }

    const { userId } = await this.registration.register({ email: input.email, password: input.password });
    await this.ensureMembership(userId, roleIds);
    return { sessionToken: await this.mintSession(userId) };
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

  private async acceptInvitation(email: string, token: string): Promise<string[]> {
    const list = await this.invitations.list();
    await this.invitations.accept({ plaintextToken: token, acceptingUserId: '', acceptingEmail: email });
    const matched = list.find((i) => i.email.toLowerCase() === email.toLowerCase() && i.status === 'pending');
    return matched ? matched.invitedRoleIds : [];
  }

  private async ensureMembership(userId: string, roleIds: string[]): Promise<void> {
    const existing = await this.memberships.findByUserAndTenant(userId, DEFAULT_TENANT);
    const membership = existing ?? TenantMembership.create({ id: crypto.randomUUID(), userId, roleIds });
    if (existing) existing.assignRoles(roleIds);
    await this.memberships.save(membership);
  }

  private async mintSession(userId: string): Promise<string> {
    const now = this.clock.now();
    // Bind the session to the ambient tenant (OSS: always DEFAULT_TENANT; a
    // multi-tenant wrapper scoping this flow via runWithTenant gets a session
    // whose principal resolves against that tenant's memberships).
    const session = AuthSession.rehydrate({
      id: crypto.randomUUID(), userId, activeTenantId: getTenantId(), status: SessionStatus.Active,
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_MS), idleExpiresAt: new Date(now.getTime() + IDLE_MS),
    });
    await this.sessions.create(session);
    return this.signer.sign({ sessionId: session.id });
  }
}
