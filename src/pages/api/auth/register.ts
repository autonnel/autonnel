import type { APIContext } from 'astro';
import { makeIdentity } from '@/composition/make-identity';
import { resolveIdentityDeps, jsonResponse, sessionCookie } from '@/composition/identity-deps';
import { RegistrationRequiresInvitationError } from '@/modules/identity/application/registration-flow-service';
import { ExistingAccountPasswordMismatchError } from '@/modules/identity/application/registration-service';

export async function POST(context: APIContext): Promise<Response> {
  let body: { username?: unknown; email?: unknown; password?: unknown; invitationToken?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  // The username field carries the login identifier; the DDD User keys on email,
  // so prefer an explicit email and fall back to the username.
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : username;
  const password = typeof body.password === 'string' ? body.password : '';
  const invitationToken = typeof body.invitationToken === 'string' && body.invitationToken.trim()
    ? body.invitationToken.trim()
    : undefined;

  if (!email || !password) {
    return jsonResponse({ error: 'Email and password required' }, 400);
  }

  // Open signup is disabled: the first admin is created by the /setup wizard,
  // every further account joins through an invitation from Settings → Users.
  if (!invitationToken) {
    return jsonResponse({ error: 'Registration requires an invitation' }, 400);
  }

  const identity = makeIdentity(resolveIdentityDeps(context));
  try {
    const { sessionToken } = await identity.registrationFlow.register({ email, password, invitationToken });
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    res.headers.set('set-cookie', sessionCookie(context, sessionToken));
    return res;
  } catch (err) {
    if (err instanceof RegistrationRequiresInvitationError || err instanceof ExistingAccountPasswordMismatchError) {
      return jsonResponse({ error: err.message }, 400);
    }
    return jsonResponse({ error: 'Registration failed' }, 400);
  }
}
