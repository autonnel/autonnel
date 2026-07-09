import type { AstroGlobal, APIContext } from 'astro';
import {
  getUserRoles,
  getUserFeatures,
  deriveAccessibleNavIds,
  userHasFeature,
  canAccessPermissionsPageAsync,
  type FeatureId,
} from '@/lib/rbac';
import { getActiveAuthProvider } from '@/lib/plugins/registry';
import { getCurrentPrincipal } from '@/modules/identity/infra/als-tenant-context';
import { isUserPrincipal } from '@/modules/shared-kernel/principal';

export interface AuthUser {
  id: string;
  providerId: string;
  email: string;
  username: string;
  name: string | null;
  avatar: string | null;
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthUser | null;
  roles: string[];
  features: string[];
  accessibleNavIds: string[];
}

type AstroContext = AstroGlobal | APIContext;

interface ResolvedIdentity {
  id: string;
  email: string;
}

function anonymousResult(): AuthResult {
  return {
    authenticated: false,
    user: null,
    roles: [],
    features: [],
    accessibleNavIds: [],
  };
}

function identityFromPrincipal(): ResolvedIdentity | null {
  const principal = getCurrentPrincipal();
  if (!principal || !isUserPrincipal(principal)) return null;
  return { id: principal.userId, email: '' };
}

async function identityFromProvider(request: Request): Promise<ResolvedIdentity | null> {
  const provider = getActiveAuthProvider();
  if (!provider) return null;
  const session = await provider.verifySession(request);
  if (!session) return null;
  return { id: session.id, email: session.email };
}

async function resolveIdentity(context: AstroContext): Promise<ResolvedIdentity | null> {
  return identityFromPrincipal() ?? (await identityFromProvider(context.request));
}

function toAuthUser(identity: ResolvedIdentity): AuthUser {
  return {
    id: identity.id,
    providerId: identity.id,
    email: identity.email,
    username: identity.email,
    name: null,
    avatar: null,
  };
}

export async function checkAuth(_context: AstroContext): Promise<AuthResult> {
  const identity = await resolveIdentity(_context);
  if (!identity) return anonymousResult();

  const user = toAuthUser(identity);
  const [roles, features] = await Promise.all([
    getUserRoles(user.id),
    getUserFeatures(user.id),
  ]);

  return {
    authenticated: true,
    user,
    roles,
    features,
    accessibleNavIds: deriveAccessibleNavIds(features, user.id, user.providerId),
  };
}

export async function requireAuth(context: AstroGlobal): Promise<AuthUser | Response> {
  const { authenticated, user } = await checkAuth(context);
  return authenticated && user ? user : context.redirect('/login');
}

async function resolveSignedInUser(context: AstroContext): Promise<AuthUser | null> {
  const { authenticated, user } = await checkAuth(context);
  return authenticated && user ? user : null;
}

export async function checkFeatureAccess(
  context: AstroContext,
  feature: FeatureId
): Promise<boolean> {
  const user = await resolveSignedInUser(context);
  if (!user) return false;
  return userHasFeature(user.id, feature);
}

export async function checkPermissionsAccess(
  context: AstroContext
): Promise<boolean> {
  const user = await resolveSignedInUser(context);
  if (!user) return false;
  return canAccessPermissionsPageAsync(user.id, user.providerId);
}
