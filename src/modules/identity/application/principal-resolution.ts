import { getCurrentPrincipal, getCurrentTenantId } from '../infra/als-tenant-context';
import type { FeatureKey } from '../domain/feature-key';
import type { Principal } from '../../shared-kernel/principal';

// In-process API (PrincipalResolutionPort): every context imports these to gate sensitive ops — zero network hop.
export function getPrincipal(): Principal | null {
  return getCurrentPrincipal();
}

export function getTenantId(): string {
  return getCurrentTenantId();
}

export function requireFeature(key: FeatureKey): void {
  const principal = getCurrentPrincipal();
  if (!principal || !principal.permissions.has(key)) {
    throw new ForbiddenError(key);
  }
}

export class ForbiddenError extends Error {
  constructor(public readonly featureKey: FeatureKey) {
    super(`Forbidden: missing feature ${featureKey}`);
    this.name = 'ForbiddenError';
  }
}
