import { getBrandingName, getBrandingLogo, getDefaultCdnUrl, getSiteTimezone } from '@/lib/config/keys';
import { PrismaDomainRepository } from '@/lib/repositories/domain.repository';
import { getEmailKvConfig } from '@/lib/config/email';

export interface StoreIdentity {
  storeName: string;
  storeUrl: string;
  storeEmail: string;
  storeLogo: string;
  timeZone: string;
}

// Store identity injected into transactional email templates. Used by order lifecycle and recall
// alike. Missing values resolve to '' so templates degrade gracefully.
export async function loadStoreIdentity(): Promise<StoreIdentity> {
  const [name, logo, primary, cdnUrl, email, timeZone] = await Promise.all([
    getBrandingName(),
    getBrandingLogo(),
    new PrismaDomainRepository().getPrimary(),
    getDefaultCdnUrl(),
    getEmailKvConfig(),
    getSiteTimezone(),
  ]);

  const storeUrl = primary?.host ? `https://${primary.host}` : (cdnUrl ?? '');

  return {
    storeName: name ?? '',
    storeUrl,
    storeEmail: email?.fromEmail ?? '',
    storeLogo: logo?.url ?? '',
    timeZone,
  };
}
