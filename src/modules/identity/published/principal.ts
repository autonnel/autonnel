import {
  requireFeature as requireFeatureInternal,
  getPrincipal as getPrincipalInternal,
  getTenantId as getTenantIdInternal,
  ForbiddenError,
} from '../application/principal-resolution';
import { toFeatureKey } from '../domain/feature-key';
import type { Principal } from '../../shared-kernel/principal';

export function requireFeature(key: string): void {
  requireFeatureInternal(toFeatureKey(key));
}

export function getPrincipal(): Principal | null {
  return getPrincipalInternal();
}

export function getTenantId(): string {
  return getTenantIdInternal();
}

export { ForbiddenError };
