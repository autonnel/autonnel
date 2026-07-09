import { getConfig } from '../../../../lib/config/get-config';
import { decryptCredentials } from '../../../../lib/services/credentials-crypto';
import type { TenantConfigPort } from '../../application/ports/outbound';
import type { PspSlug } from '../../domain/value-objects';

export class AppConfigTenantConfigAdapter implements TenantConfigPort {
  async configuredProviders(): Promise<PspSlug[]> {
    const cfg = (await getConfig('payment.config')) as any;
    const providers = cfg?.providers ?? {};
    return Object.keys(providers).filter((p) => providers[p]?.isActive !== false) as PspSlug[];
  }
  async providerConfig(slug: PspSlug): Promise<Record<string, string>> {
    const cfg = (await getConfig('payment.config')) as any;
    const entry = cfg?.providers?.[slug];
    if (!entry) return {};
    // Credentials are stored encrypted; the provider factory needs the plaintext
    // secretKey / clientSecret, plus any non-secret settings (mode, baseUrl).
    const creds = (decryptCredentials(entry.credentials) ?? {}) as Record<string, string>;
    return { ...(entry.settings ?? {}), ...creds };
  }
}
