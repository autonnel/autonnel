// Curated barrel re-exporting the identity composition + session-cookie helpers for package
// consumers (e.g. autonnel-saas) that need to mint real core sessions and run tenant-scoped
// identity operations. Imported by consumers as 'autonnel/identity' (resolved from src).
export { makeIdentity } from '@/composition/make-identity';
export type { IdentityDeps } from '@/composition/make-identity';
export {
  resolveIdentityDeps,
  sessionCookie,
  clearedSessionCookie,
  readSessionCookie,
  SESSION_COOKIE,
  jsonResponse,
} from '@/composition/identity-deps';
export { runWithTenant, getCurrentTenantId, getCurrentPrincipal } from '@/lib/tenant/context';
export { DEFAULT_TENANT } from '@/modules/shared-kernel/tenant-id';
export { resolveSessionSecret } from '@/lib/services/session-secret';
