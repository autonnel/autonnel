import { DEFAULT_TENANT } from '../../shared-kernel/tenant-id';
import type { HostTenantResolverPort } from '../application/ports/outbound';

export class OssHostTenantResolver implements HostTenantResolverPort {
  async resolveFromHost(_host: string | null): Promise<string> {
    return DEFAULT_TENANT;
  }
}

export class DomainTableHostTenantResolver implements HostTenantResolverPort {
  constructor(private readonly lookup: (host: string) => Promise<string | null>) {}

  async resolveFromHost(host: string | null): Promise<string | null> {
    if (!host) return null;
    return this.lookup(host);
  }
}
