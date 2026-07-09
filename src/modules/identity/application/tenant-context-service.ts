import { TenantContextResolver } from '../domain/services/tenant-context-resolver';
import { runWithContext } from '../infra/als-tenant-context';
import type { Principal } from '../../shared-kernel/principal';
import type { HostTenantResolverPort } from './ports/outbound';
import type { AuthenticationService } from './authentication-service';
import type { ApiAuthenticationService } from './api-authentication-service';

export class TenantContextService {
  private readonly resolver = new TenantContextResolver();

  constructor(
    private readonly sessionAuth: AuthenticationService,
    private readonly apiAuth: ApiAuthenticationService,
    private readonly hostResolver: HostTenantResolverPort,
  ) {}

  async establish<T>(req: Request, fn: () => Promise<T>): Promise<T> {
    const authHeader = req.headers.get('authorization');
    const apiPrincipal = await this.apiAuth.authenticate(authHeader);

    let sessionPrincipal: Principal | null = null;
    let sessionTenantId: string | null = null;
    if (!apiPrincipal) {
      const token = this.readSessionCookie(req);
      if (token) {
        sessionPrincipal = await this.sessionAuth.authenticateSession(token);
        sessionTenantId = sessionPrincipal?.tenantId ?? null;
      }
    }

    const host = req.headers.get('host');
    const hostTenantId = await this.hostResolver.resolveFromHost(host);

    const tenantId = this.resolver.resolve({
      apiKeyTenantId: apiPrincipal?.tenantId ?? null,
      sessionActiveTenantId: sessionTenantId,
      hostTenantId,
    });

    const principal = apiPrincipal ?? sessionPrincipal ?? null;
    return runWithContext({ tenantId, principal }, fn);
  }

  private readSessionCookie(req: Request): string | null {
    const cookie = req.headers.get('cookie') ?? '';
    const match = cookie.match(/(?:^|;\s*)autonnel_session=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
