// First-run setup wizard state. The wizard triggers on exactly two signals:
// an explicit `setup.completed = false` KV row (written by SaaS tenant
// provisioning), or an unset key on the OSS default tenant with zero members
// (a fresh install). Everything else — upgraded installs that already have
// users, SaaS tenants provisioned before the flag existed, and tenant-less
// sentinel hosts (SaaS app/cdn) — resolves to "completed" so the gate never
// interferes with them.
import { getSetupCompletedRaw, setSetupCompleted } from '@/lib/config/keys';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { DEFAULT_TENANT } from '@/modules/shared-kernel';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { isPublicStorefrontPath } from '@/lib/runtime/admin-host';

export interface SetupState {
  needsSetup: boolean;
  // True when no member exists yet, so the wizard must create the admin
  // account; false for provisioned SaaS tenants where only branding/timezone remain.
  needsAccount: boolean;
}

const COMPLETED = { needsSetup: false, needsAccount: false } as const;

export function normalizeCompletedFlag(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export function deriveSetupState(input: {
  completed: boolean | undefined;
  hasMembers: boolean;
  isDefaultTenant: boolean;
}): SetupState {
  if (input.completed === true) return { ...COMPLETED };
  if (input.completed === false) return { needsSetup: true, needsAccount: !input.hasMembers };
  if (input.isDefaultTenant && !input.hasMembers) return { needsSetup: true, needsAccount: true };
  return { ...COMPLETED };
}

export async function resolveSetupState(): Promise<SetupState> {
  const completed = normalizeCompletedFlag(await getSetupCompletedRaw());
  if (completed === true) return { ...COMPLETED };

  const hasMembers = (await getTenantPrisma().membership.count({})) > 0;
  const state = deriveSetupState({
    completed,
    hasMembers,
    isDefaultTenant: getCurrentTenantId() === DEFAULT_TENANT,
  });

  // Unset key that derives to "completed" (grandfathered installs, SaaS sentinel
  // hosts): persist the flag once so steady state is a single memoized config
  // read, not a count query. A later explicit write (SaaS provisioning) overrides.
  if (!state.needsSetup && completed === undefined) {
    await setSetupCompleted(true);
  }
  return state;
}

// Paths the setup gate must never redirect: the wizard itself, session exits,
// API calls (the wizard and login POST through them), and everything the
// storefront serves on shared hosts (assets, tracked pages, shop APIs).
export function isSetupExemptPath(pathname: string): boolean {
  if (pathname === '/setup' || pathname === '/logout') return true;
  if (pathname.startsWith('/api/')) return true;
  return isPublicStorefrontPath(pathname);
}
