import { AuthenticationService } from '@/modules/identity/application/authentication-service';
import { ApiAuthenticationService } from '@/modules/identity/application/api-authentication-service';
import { TenantContextService } from '@/modules/identity/application/tenant-context-service';
import { RegistrationService } from '@/modules/identity/application/registration-service';
import { ChangePasswordService } from '@/modules/identity/application/change-password-service';
import { RegistrationFlowService } from '@/modules/identity/application/registration-flow-service';
import { DashboardProvisioningService } from '@/modules/identity/application/dashboard-provisioning-service';
import { DashboardPasswordResetService } from '@/modules/identity/application/dashboard-password-reset-service';
import { InvitationService } from '@/modules/identity/application/invitation-service';
import { RoleDashboardService } from '@/modules/identity/application/role-dashboard-service';
import { MembershipDashboardService } from '@/modules/identity/application/membership-dashboard-service';
import { MemberDirectoryService } from '@/modules/identity/application/member-directory-service';
import { ApiKeyService } from '@/modules/identity/application/api-key-service';
import { StaticFeatureCatalog } from '@/modules/identity/infra/feature-catalog';
import { WebCryptoPasswordHasher } from '@/modules/identity/infra/crypto/web-crypto-password-hasher';
import { JwsTokenSigner } from '@/modules/identity/infra/crypto/jws-token-signer';
import { WebCryptoSecretGenerator } from '@/modules/identity/infra/crypto/web-crypto-secret-generator';
import { PrismaUserRepository } from '@/modules/identity/infra/prisma/prisma-user-repository';
import { PrismaMembershipRepository } from '@/modules/identity/infra/prisma/prisma-membership-repository';
import { PrismaRoleRepository } from '@/modules/identity/infra/prisma/prisma-role-repository';
import { PrismaInvitationRepository } from '@/modules/identity/infra/prisma/prisma-invitation-repository';
import { PrismaApiKeyRepository } from '@/modules/identity/infra/prisma/prisma-api-key-repository';
import { PrismaSessionStore } from '@/modules/identity/infra/prisma/prisma-session-store';
import { OssHostTenantResolver } from '@/modules/identity/infra/host-tenant-resolver';
import { NoopDomainEventPublisher, NoopNotificationPort } from '@/modules/identity/infra/noop-adapters';
import { WorkersClock } from '@/modules/identity/infra/clock';

export interface IdentityDeps {
  rawPrisma: any;
  scopedPrisma: any;
  sessionSecret: string;
}

export function makeIdentity(deps: IdentityDeps) {
  const clock = new WorkersClock();
  const hasher = new WebCryptoPasswordHasher();
  const signer = new JwsTokenSigner(deps.sessionSecret);
  const secrets = new WebCryptoSecretGenerator();
  const catalog = new StaticFeatureCatalog();
  const events = new NoopDomainEventPublisher();
  const notify = new NoopNotificationPort();

  const users = new PrismaUserRepository(deps.rawPrisma);
  const memberships = new PrismaMembershipRepository(deps.scopedPrisma);
  const roles = new PrismaRoleRepository(deps.scopedPrisma, catalog);
  const invitations = new PrismaInvitationRepository(deps.scopedPrisma);
  const apiKeys = new PrismaApiKeyRepository(deps.rawPrisma, deps.scopedPrisma);
  const sessions = new PrismaSessionStore(deps.rawPrisma);

  const authentication = new AuthenticationService(users, memberships, roles, sessions, hasher, signer, clock);
  const apiAuth = new ApiAuthenticationService(apiKeys, secrets, clock);
  const tenantContext = new TenantContextService(authentication, apiAuth, new OssHostTenantResolver());

  const registration = new RegistrationService(users, hasher, events, clock);
  const invitationService = new InvitationService(invitations, memberships, secrets, events, notify, clock);

  return {
    tenantContext,
    authentication,
    apiAuth,
    registration,
    registrationFlow: new RegistrationFlowService(registration, invitationService, memberships, roles, sessions, signer, catalog, clock),
    dashboardProvisioning: new DashboardProvisioningService(registration, memberships, roles, catalog),
    dashboardPasswordReset: new DashboardPasswordResetService(users, hasher, sessions),
    get adminProvisioning() { return this.dashboardProvisioning; },
    get adminPasswordReset() { return this.dashboardPasswordReset; },
    changePassword: new ChangePasswordService(users, hasher, sessions, signer, events),
    invitations: invitationService,
    roleDashboard: new RoleDashboardService(roles, catalog, events),
    membershipDashboard: new MembershipDashboardService(memberships, events),
    memberDirectory: new MemberDirectoryService(memberships, users, roles),
    apiKeys: new ApiKeyService(apiKeys, secrets, events, clock),
  };
}
