import type { APIContext } from 'astro';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps, jsonResponse, sessionCookie } from '@/composition/identity-deps';
import { RegistrationRequiresInvitationError } from '@/modules/identity/application/registration-flow-service';
import { resolveSetupState } from '@/lib/auth/setup-state';
import { checkFeatureAccess } from '@/lib/auth/middleware';
import { FEATURES } from '@/lib/rbac';
import { setBrandingName, setSiteTimezone, setSetupCompleted } from '@/lib/config/keys';
import { TIMEZONE_OPTIONS } from '@/lib/constants/timezone';
import { Email } from '@/modules/identity/domain/email';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AuthSetup');

export async function POST(context: APIContext): Promise<Response> {
  let body: { username?: unknown; password?: unknown; brandingName?: unknown; timezone?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const state = await resolveSetupState();
  if (!state.needsSetup) {
    return jsonResponse({ error: 'Setup already completed' }, 409);
  }

  const brandingName = typeof body.brandingName === 'string' ? body.brandingName.trim() : '';
  if (!brandingName || brandingName.length > 60) {
    return jsonResponse({ error: 'Site name is required (max 60 characters)' }, 400);
  }
  const timezone = typeof body.timezone === 'string' ? body.timezone : '';
  if (!TIMEZONE_OPTIONS.some((o) => o.value === timezone)) {
    return jsonResponse({ error: 'Invalid timezone' }, 400);
  }

  let setCookie: string | undefined;
  if (state.needsAccount) {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!Email.isValid(username)) {
      return jsonResponse({ error: 'A valid email address is required' }, 400);
    }
    if (password.length < 8) {
      return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
    }

    const identity = makeIdentity(resolveIdentityDeps(context));
    try {
      // First-user path of the registration flow: creates the account, seeds the
      // Admin role and mints a session. A concurrent setup that won the race makes
      // this throw RegistrationRequiresInvitationError.
      const { sessionToken } = await identity.registrationFlow.register({ email: username, password });
      setCookie = sessionCookie(context, sessionToken);
    } catch (err) {
      if (err instanceof RegistrationRequiresInvitationError) {
        return jsonResponse({ error: 'Setup already completed' }, 409);
      }
      logger.error('Setup account creation failed', { error: err });
      return jsonResponse({ error: 'Account creation failed' }, 400);
    }
  } else {
    const allowed = await checkFeatureAccess(context, FEATURES.SETTINGS_BRANDING);
    if (!allowed) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  await setBrandingName(brandingName);
  await setSiteTimezone(timezone);
  await setSetupCompleted(true);

  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  if (setCookie) res.headers.set('set-cookie', setCookie);
  return res;
}
