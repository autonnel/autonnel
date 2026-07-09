import type { PolicyHooks } from '@/lib/plugins/types';
import { hostMatchesAdminPattern } from '@/lib/runtime/admin-host';

function isAdminHost(request: Request): boolean {
  let hostname: string;
  try {
    hostname = new URL(request.url).hostname;
  } catch {
    return false;
  }
  return hostMatchesAdminPattern(hostname);
}

export const DEFAULT_POLICY_HOOKS: Required<PolicyHooks> = {
  canEditMaintenance: () => true,
  maxCustomDomains: () => Number.POSITIVE_INFINITY,
  bypassStorefrontDomainCheck: isAdminHost,
  storageBannerEnabled: () => true,
  getGlobalBanners: () => [],
};
